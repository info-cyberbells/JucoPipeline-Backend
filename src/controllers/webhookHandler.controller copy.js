import stripe from "../config/stripe.js";
import outseta from "../config/outseta.config.js";
import User from "../models/user.model.js";
import PendingRegistration from "../models/pendingRegistration.model.js";
import Subscription from "../models/subscription.model.js";
import mongoose from "mongoose";


// ============================================
// OUTSETA WEBHOOK HANDLER
// ============================================
export const handleOutsetaWebhook = async (req, res) => {
  try {
    const event = req.body;

    console.log(`✅ Outseta Webhook received: ${event.Type}`);

    switch (event.Type) {
      case "account.subscription.created":
        await handleSubscriptionCreated(event.Data);
        break;

      case "account.subscription.updated":
        await handleSubscriptionUpdated(event.Data);
        break;

      case "account.subscription.cancelled":
        await handleSubscriptionCancelled(event.Data);
        break;

      case "payment.succeeded":
        await handlePaymentSucceeded(event.Data);
        break;

      case "payment.failed":
        await handlePaymentFailed(event.Data);
        break;

      default:
        console.log(`⚠️ Unhandled event: ${event.Type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✅ Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompletedWithRegistration(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

async function handleCheckoutCompletedWithRegistrationOLDDDDD(session) {
  const pendingRegistrationId = session.metadata?.pendingRegistrationId;
  const subscriptionId = session.subscription;

  console.log(`✅ Checkout completed. Pending Reg: ${pendingRegistrationId}`);

  if (!pendingRegistrationId) {
    // Normal subscription update (existing users)
    return await handleCheckoutCompleted(session);
  }

  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.startTransaction();

    // Get pending registration
    const pendingReg = await PendingRegistration.findById(pendingRegistrationId).session(mongoSession);

    if (!pendingReg) {
      console.error("❌ Pending registration not found");
      await mongoSession.abortTransaction();
      return;
    }

    if (pendingReg.status === "completed") {
      console.log("⚠️ Registration already completed");
      await mongoSession.abortTransaction();
      return;
    }

    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Create User
    const userData = {
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      email: pendingReg.email,
      password: pendingReg.password, // Already hashed
      role: pendingReg.role,
      state: pendingReg.state,
      profileImage: pendingReg.profileImage,
      registrationStatus: "approved",
      stripeCustomerId: session.customer,
      subscriptionStatus: stripeSubscription.status,
      subscriptionPlan: pendingReg.plan,
      subscriptionEndDate: new Date(stripeSubscription.current_period_end * 1000)
    };

    // Role-specific fields
    if (pendingReg.role === "scout") {
      userData.team = pendingReg.teamId;
      userData.jobTitle = pendingReg.jobTitle;
    } else if (pendingReg.role === "coach") {
      userData.school = pendingReg.school;
      userData.division = pendingReg.division;
      userData.conference = pendingReg.conference;
    }

    const [user] = await User.create([userData], { session: mongoSession });

    // Create Subscription
    await Subscription.create([{
      user: user._id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: pendingReg.plan,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      paymentProvider: "stripe",
      cancelAtPeriodEnd: false
    }], { session: mongoSession });

    // Update pending registration status
    pendingReg.status = "completed";
    await pendingReg.save({ session: mongoSession });

    await mongoSession.commitTransaction();

    console.log(`✅ Registration completed for user: ${user._id}`);

    // Optional: Send welcome email
    // await sendWelcomeEmail(user.email, user.firstName);

  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("❌ Error completing registration:", error);
  } finally {
    mongoSession.endSession();
  }
}

async function handleCheckoutCompletedWithRegistration(session) {
  const pendingRegistrationId = session.metadata?.pendingRegistrationId;
  const subscriptionId = session.subscription;

  console.log(`✅ Checkout completed. Pending Reg: ${pendingRegistrationId}`);

  if (!pendingRegistrationId) {
    // Normal subscription update (existing users)
    return await handleCheckoutCompleted(session);
  }

  let createdUser = null;
  let createdSubscription = null;

  try {
    // Get pending registration
    const pendingReg = await PendingRegistration.findById(pendingRegistrationId);

    if (!pendingReg) {
      console.error("❌ Pending registration not found");
      return;
    }

    if (pendingReg.status === "completed") {
      console.log("⚠️ Registration already completed");
      return;
    }

    // ============================================
    // FIX: Properly retrieve subscription with expand
    // ============================================
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    console.log('Stripe Subscription:', stripeSubscription);
    console.log('Current Period End:', stripeSubscription.current_period_end);

    // ============================================
    // FIX: Validate and format dates
    // ============================================
    const currentPeriodEnd = stripeSubscription.current_period_end 
      ? new Date(stripeSubscription.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days from now

    const currentPeriodStart = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : new Date();

    // Validate dates
    if (isNaN(currentPeriodEnd.getTime())) {
      console.error("❌ Invalid currentPeriodEnd date");
      throw new Error("Invalid subscription dates from Stripe");
    }

    // Create User
    const userData = {
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      email: pendingReg.email,
      password: pendingReg.password, // Already hashed
      role: pendingReg.role,
      state: pendingReg.state,
      profileImage: pendingReg.profileImage,
      registrationStatus: "approved",
      stripeCustomerId: session.customer,
      subscriptionStatus: stripeSubscription.status,
      subscriptionPlan: pendingReg.plan,
      subscriptionEndDate: currentPeriodEnd // Fixed date
    };

    // Role-specific fields
    if (pendingReg.role === "scout") {
      userData.team = pendingReg.teamId;
      userData.jobTitle = pendingReg.jobTitle;
    } else if (pendingReg.role === "coach") {
      userData.school = pendingReg.school;
      userData.division = pendingReg.division;
      userData.conference = pendingReg.conference;
    }

    console.log('Creating user with data:', userData);

    createdUser = await User.create(userData);

    console.log('✅ User created:', createdUser._id);

    // Create Subscription
    createdSubscription = await Subscription.create({
      user: createdUser._id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: pendingReg.plan,
      status: stripeSubscription.status,
      currentPeriodStart: currentPeriodStart, // Fixed date
      currentPeriodEnd: currentPeriodEnd, // Fixed date
      paymentProvider: "stripe",
      cancelAtPeriodEnd: false,
      trialStart: stripeSubscription.trial_start 
        ? new Date(stripeSubscription.trial_start * 1000) 
        : null,
      trialEnd: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000) 
        : null
    });

    console.log('✅ Subscription created:', createdSubscription._id);

    // Update pending registration status
    pendingReg.status = "completed";
    await pendingReg.save();

    console.log(`✅ Registration completed successfully for user: ${createdUser._id}`);
    console.log(`✅ Email: ${createdUser.email}`);

  } catch (error) {
    console.error("❌ Error completing registration:", error);
    
    // Rollback on error
    if (createdSubscription) {
      try {
        await Subscription.findByIdAndDelete(createdSubscription._id);
        console.log('🔄 Rolled back subscription');
      } catch (e) {
        console.error("Failed to rollback subscription:", e);
      }
    }
    
    if (createdUser) {
      try {
        await User.findByIdAndDelete(createdUser._id);
        console.log('🔄 Rolled back user');
      } catch (e) {
        console.error("Failed to rollback user:", e);
      }
    }
  }
}

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const subscriptionId = session.subscription;

  console.log(`✅ Checkout completed for user: ${userId}, plan: ${plan}`);

  if (!userId || !subscriptionId) {
    console.error("❌ Missing userId or subscriptionId in checkout session");
    return;
  }

  try {
    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Create or update subscription in database
    const subscription = await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      {
        user: userId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: stripeSubscription.items.data[0].price.id,
        plan: plan,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: false,
        trialStart: stripeSubscription.trial_start 
          ? new Date(stripeSubscription.trial_start * 1000) 
          : null,
        trialEnd: stripeSubscription.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000) 
          : null
      },
      { upsert: true, new: true }
    );

    // Update user document
    await User.findByIdAndUpdate(userId, {
      stripeCustomerId: session.customer,
      subscriptionStatus: stripeSubscription.status,
      subscriptionPlan: plan,
      subscriptionEndDate: new Date(stripeSubscription.current_period_end * 1000)
    });

    console.log(`✅ Subscription created/updated in database: ${subscription._id}`);
  } catch (error) {
    console.error("❌ Error in handleCheckoutCompleted:", error);
  }
}

async function handleSubscriptionCreated(data) {
  let createdUser = null;
  let createdSubscription = null;

  try {
    const { 
      Account, 
      Plan, 
      Uid, 
      SubscriptionStatus, 
      CurrentPeriodStart, 
      CurrentPeriodEnd 
    } = data;

    console.log(`✅ Processing subscription created: ${Uid}`);

    // ============================================
    // FIND PENDING REGISTRATION BY OUTSETA ACCOUNT
    // ============================================
    const pendingReg = await PendingRegistration.findOne({
      outsetaAccountUid: Account.Uid
    });

    if (!pendingReg) {
      console.error("❌ Pending registration not found for account:", Account.Uid);
      
      // Try to find by email as fallback
      const accountDetails = await outseta.getPerson(Account.PrimaryContact.Uid);
      const pendingByEmail = await PendingRegistration.findOne({
        email: accountDetails.Email
      });

      if (!pendingByEmail) {
        console.error("❌ No pending registration found for this subscription");
        return;
      }
      
      // Update pending with Outseta IDs
      pendingByEmail.outsetaAccountUid = Account.Uid;
      pendingByEmail.outsetaPersonUid = Account.PrimaryContact.Uid;
      await pendingByEmail.save();
      
      return await completePendingRegistration(pendingByEmail, data);
    }

    // Check if already completed
    if (pendingReg.status === "completed") {
      console.log("⚠️ Registration already completed");
      return;
    }

    await completePendingRegistration(pendingReg, data);

  } catch (error) {
    console.error("❌ Error handling subscription created:", error);
    
    // Rollback on error
    if (createdSubscription) {
      try {
        await Subscription.findByIdAndDelete(createdSubscription._id);
        console.log('🔄 Rolled back subscription');
      } catch (e) {
        console.error("Failed to rollback subscription:", e);
      }
    }
    
    if (createdUser) {
      try {
        await User.findByIdAndDelete(createdUser._id);
        console.log('🔄 Rolled back user');
      } catch (e) {
        console.error("Failed to rollback user:", e);
      }
    }
  }
}


// ============================================
// HANDLE SUBSCRIPTION UPDATED (Existing Users)
// ============================================
async function handleSubscriptionUpdated(data) {
  try {
    const { Uid, SubscriptionStatus, CurrentPeriodEnd } = data;

    console.log(`🔄 Subscription updated: ${Uid}`);

    // Find subscription in YOUR database
    const subscription = await Subscription.findOne({ 
      outsetaSubscriptionUid: Uid 
    });

    if (!subscription) {
      console.log("⚠️ Subscription not found in database");
      return;
    }

    // Update subscription
    subscription.status = SubscriptionStatus.toLowerCase();
    subscription.currentPeriodEnd = new Date(CurrentPeriodEnd);
    await subscription.save();

    // Update user
    await User.findByIdAndUpdate(subscription.user, {
      subscriptionStatus: SubscriptionStatus.toLowerCase(),
      subscriptionEndDate: new Date(CurrentPeriodEnd)
    });

    console.log(`✅ Subscription updated: ${Uid}`);

  } catch (error) {
    console.error("❌ Error handling subscription updated:", error);
  }
}

// ============================================
// COMPLETE PENDING REGISTRATION
// ============================================
async function completePendingRegistration(pendingReg, subscriptionData) {
  const { 
    Uid, 
    SubscriptionStatus, 
    CurrentPeriodStart, 
    CurrentPeriodEnd,
    Plan 
  } = subscriptionData;

  console.log(`✅ Completing registration for: ${pendingReg.email}`);

  let createdUser = null;
  let createdSubscription = null;

  try {
    // ============================================
    // CREATE USER
    // ============================================
    const userData = {
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      email: pendingReg.email,
      password: pendingReg.password,
      role: pendingReg.role,
      state: pendingReg.state,
      profileImage: pendingReg.profileImage,
      registrationStatus: "approved",
      outsetaPersonUid: pendingReg.outsetaPersonUid,
      outsetaAccountUid: pendingReg.outsetaAccountUid,
      subscriptionStatus: SubscriptionStatus.toLowerCase(),
      subscriptionPlan: Plan.Name,
      subscriptionEndDate: new Date(CurrentPeriodEnd)
    };

    // Role-specific fields
    if (pendingReg.role === "scout") {
      userData.team = pendingReg.teamId;
      userData.jobTitle = pendingReg.jobTitle;
    } else if (pendingReg.role === "coach") {
      userData.school = pendingReg.school;
      userData.division = pendingReg.division;
      userData.conference = pendingReg.conference;
    }

    createdUser = await User.create(userData);
    console.log(`✅ User created: ${createdUser._id}`);

    // ============================================
    // CREATE SUBSCRIPTION
    // ============================================
    createdSubscription = await Subscription.create({
      user: createdUser._id,
      outsetaSubscriptionUid: Uid,
      outsetaAccountUid: pendingReg.outsetaAccountUid,
      plan: pendingReg.plan,
      status: SubscriptionStatus.toLowerCase(),
      currentPeriodStart: new Date(CurrentPeriodStart),
      currentPeriodEnd: new Date(CurrentPeriodEnd),
      paymentProvider: "outseta",
      cancelAtPeriodEnd: false
    });

    console.log(`✅ Subscription created: ${createdSubscription._id}`);

    // ============================================
    // UPDATE PENDING REGISTRATION
    // ============================================
    pendingReg.status = "completed";
    pendingReg.outsetaSubscriptionUid = Uid;
    await pendingReg.save();

    console.log(`✅ Registration completed for: ${createdUser.email}`);

    // Optional: Send welcome email
    // await sendWelcomeEmail(createdUser);

    return { user: createdUser, subscription: createdSubscription };

  } catch (error) {
    console.error("❌ Error completing registration:", error);

    // Rollback
    if (createdSubscription) {
      await Subscription.findByIdAndDelete(createdSubscription._id);
      console.log('🔄 Rolled back subscription');
    }

    if (createdUser) {
      await User.findByIdAndDelete(createdUser._id);
      console.log('🔄 Rolled back user');
    }

    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log(`🗑️ Subscription deleted: ${subscription.id}`);

  try {
    const dbSubscription = await Subscription.findOne({ 
      stripeSubscriptionId: subscription.id 
    });

    if (!dbSubscription) {
      console.log("⚠️ Subscription not found in database");
      return;
    }

    // Mark as canceled
    dbSubscription.status = "canceled";
    dbSubscription.canceledAt = new Date();
    await dbSubscription.save();

    // Update user document
    await User.findByIdAndUpdate(dbSubscription.user, {
      subscriptionStatus: "canceled",
      subscriptionPlan: "none"
    });

    console.log(`✅ Subscription marked as canceled in database`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionDeleted:", error);
  }
}

// ============================================
// HANDLE PAYMENT SUCCESS
// ============================================
async function handlePaymentSucceeded(data) {
  console.log(`✅ Payment succeeded:`, data);
  // Optional: Send receipt email
}

// ============================================
// HANDLE SUBSCRIPTION CANCELLED
// ============================================
async function handleSubscriptionCancelled(data) {
  try {
    const { Uid } = data;

    console.log(`🗑️ Subscription cancelled: ${Uid}`);

    const subscription = await Subscription.findOne({ 
      outsetaSubscriptionUid: Uid 
    });

    if (!subscription) {
      console.log("⚠️ Subscription not found");
      return;
    }

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    await subscription.save();

    await User.findByIdAndUpdate(subscription.user, {
      subscriptionStatus: 'canceled'
    });

    console.log(`✅ Subscription cancelled: ${Uid}`);

  } catch (error) {
    console.error("❌ Error handling subscription cancelled:", error);
  }
}

// ============================================
// HANDLE PAYMENT FAILED
// ============================================
async function handlePaymentFailed(data) {
  console.log(`❌ Payment failed:`, data);
  // Optional: Send notification to user
}

async function handleUpcomingInvoice(invoice) {
  console.log(`📅 Upcoming invoice: ${invoice.id}`);
  
  // TODO: Send email notification about upcoming payment
  // You can implement this later to notify users before renewal
}