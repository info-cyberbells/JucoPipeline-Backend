import { verifyPayPalWebhook } from "../config/paypal.config.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import PendingRegistration from "../models/pendingRegistration.model.js";
import mongoose from "mongoose";

// ============================================
// HANDLE PAYPAL WEBHOOK
// ============================================
export const handlePayPalWebhook = async (req, res) => {
  try {
    console.log('=== PayPal Webhook Received ===');
    console.log('Event Type:', req.body.event_type);

    const isValid = await verifyPayPalWebhook(req.headers, req.body);
    
    if (!isValid) {
      console.error('❌ PayPal webhook signature verification failed');
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    console.log('✅ PayPal webhook signature verified');

    const event = req.body;
    const eventType = event.event_type;

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivatedWithRegistration(event);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;

      // ... other cases remain same
    }

    res.json({ received: true });

  } catch (error) {
    console.error('PayPal Webhook Error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

async function handleSubscriptionActivatedWithRegistration(event) {
  const subscriptionData = event.resource;
  const customId = subscriptionData.custom_id;

  console.log('=== SUBSCRIPTION ACTIVATED ===');
  console.log('Custom ID:', customId);
  console.log('Subscription ID:', subscriptionData.id);

  let createdUser = null;
  let createdSubscription = null;

  try {
    // Check if it's a pending registration
    const pendingReg = await PendingRegistration.findById(customId);

    if (pendingReg) {
      // This is a new registration
      console.log('📝 Completing new registration for:', pendingReg.email);

      if (pendingReg.status === "completed") {
        console.log("⚠️ Registration already completed");
        return;
      }

      // ============================================
      // FIX: Safely parse dates
      // ============================================
      const nextBillingTime = subscriptionData.billing_info?.next_billing_time;
      const startTime = subscriptionData.start_time;

      const subscriptionEndDate = nextBillingTime 
        ? new Date(nextBillingTime)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const subscriptionStartDate = startTime
        ? new Date(startTime)
        : new Date();

      // Validate dates
      if (isNaN(subscriptionEndDate.getTime())) {
        console.error("❌ Invalid subscription end date");
        throw new Error("Invalid subscription dates from PayPal");
      }

      console.log('Subscription Start:', subscriptionStartDate);
      console.log('Subscription End:', subscriptionEndDate);

      // ============================================
      // FIX: Build user data with proper field handling
      // ============================================
      const userData = {
        firstName: pendingReg.firstName,
        lastName: pendingReg.lastName,
        email: pendingReg.email,
        password: pendingReg.password, // Already hashed
        role: pendingReg.role,
        state: pendingReg.state || null,
        profileImage: pendingReg.profileImage || null,
        registrationStatus: "approved",
        paypalSubscriptionId: subscriptionData.id,
        subscriptionStatus: "active",
        subscriptionPlan: pendingReg.plan,
        subscriptionEndDate: subscriptionEndDate
      };

      // ============================================
      // FIX: Role-specific fields with proper checks
      // ============================================
      if (pendingReg.role === "scout") {
        // For scout - team and jobTitle are required
        userData.team = pendingReg.teamId || null;
        userData.jobTitle = pendingReg.jobTitle || "Scout"; // Default value if not set
        
        console.log('Scout data:', {
          team: userData.team,
          jobTitle: userData.jobTitle
        });
      } else if (pendingReg.role === "coach") {
        // For coach - school, division, conference are required
        userData.school = pendingReg.school || null;
        userData.division = pendingReg.division || null;
        userData.conference = pendingReg.conference || null;
        
        console.log('Coach data:', {
          school: userData.school,
          division: userData.division,
          conference: userData.conference
        });
      }

      console.log('Creating user with data:', userData);
      
      createdUser = await User.create(userData);
      console.log('✅ User created:', createdUser._id);

      // Create Subscription
      console.log('Creating subscription...');
      createdSubscription = await Subscription.create({
        user: createdUser._id,
        paypalSubscriptionId: subscriptionData.id,
        plan: pendingReg.plan,
        status: "active",
        currentPeriodStart: subscriptionStartDate,
        currentPeriodEnd: subscriptionEndDate,
        paymentProvider: "paypal"
      });
      console.log('✅ Subscription created:', createdSubscription._id);

      // Mark pending registration as completed
      pendingReg.status = "completed";
      await pendingReg.save();

      console.log(`✅ Registration completed successfully!`);
      console.log(`   User ID: ${createdUser._id}`);
      console.log(`   Email: ${createdUser.email}`);
      console.log(`   Role: ${createdUser.role}`);

    } else {
      // Existing user subscription (normal flow)
      console.log('👤 Updating existing user subscription');
      await handleSubscriptionActivated(event);
    }

  } catch (error) {
    console.error('❌ Handle Subscription Activated Error:', error);
    
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
// EVENT HANDLERS
// ============================================

// Subscription Activated
async function handleSubscriptionActivated(event) {
  try {
    console.log('=== SUBSCRIPTION ACTIVATED ===');
    
    const subscriptionData = event.resource;
    const userId = subscriptionData.custom_id;

    if (!userId) {
      console.error('No user ID in subscription data');
      return;
    }

    console.log('User ID:', userId);
    console.log('PayPal Subscription ID:', subscriptionData.id);

    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return;
    }

    // Determine plan from subscription
    const planId = subscriptionData.plan_id;
    let detectedPlan = null;

    // Match plan ID to our plans
    Object.entries(require('../config/paypal.config.js').PAYPAL_SUBSCRIPTION_PLANS).forEach(([key, config]) => {
      if (config.planId === planId) {
        detectedPlan = key;
      }
    });

    if (!detectedPlan) {
      console.error('Could not match plan ID:', planId);
      detectedPlan = user.role + '_monthly'; // Fallback
    }

    // Create or update subscription in database
    let subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionData.id
    });

    if (subscription) {
      subscription.status = 'active';
      subscription.currentPeriodStart = new Date(subscriptionData.start_time);
      subscription.currentPeriodEnd = new Date(subscriptionData.billing_info.next_billing_time);
      await subscription.save();
    } else {
      subscription = await Subscription.create({
        user: userId,
        paypalSubscriptionId: subscriptionData.id,
        plan: detectedPlan,
        status: 'active',
        currentPeriodStart: new Date(subscriptionData.start_time),
        currentPeriodEnd: new Date(subscriptionData.billing_info.next_billing_time),
        paymentProvider: 'paypal'
      });
    }

    // Update user
    user.subscriptionStatus = 'active';
    user.subscriptionPlan = detectedPlan;
    user.subscriptionEndDate = new Date(subscriptionData.billing_info.next_billing_time);
    user.paypalSubscriptionId = subscriptionData.id;
    await user.save();

    console.log('✅ Subscription activated in database');

  } catch (error) {
    console.error('Handle Subscription Activated Error:', error);
  }
}

// Subscription Updated
async function handleSubscriptionUpdated(event) {
  try {
    console.log('=== SUBSCRIPTION UPDATED ===');
    
    const subscriptionData = event.resource;
    
    const subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionData.id
    });

    if (!subscription) {
      console.error('Subscription not found:', subscriptionData.id);
      return;
    }

    subscription.status = subscriptionData.status.toLowerCase();
    
    if (subscriptionData.billing_info?.next_billing_time) {
      subscription.currentPeriodEnd = new Date(subscriptionData.billing_info.next_billing_time);
    }

    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    if (user) {
      user.subscriptionStatus = subscriptionData.status.toLowerCase();
      if (subscriptionData.billing_info?.next_billing_time) {
        user.subscriptionEndDate = new Date(subscriptionData.billing_info.next_billing_time);
      }
      await user.save();
    }

    console.log('✅ Subscription updated in database');

  } catch (error) {
    console.error('Handle Subscription Updated Error:', error);
  }
}

// Subscription Cancelled
async function handleSubscriptionCancelled(event) {
  try {
    console.log('=== SUBSCRIPTION CANCELLED ===');
    
    const subscriptionData = event.resource;
    
    const subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionData.id
    });

    if (!subscription) {
      console.error('Subscription not found:', subscriptionData.id);
      return;
    }

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    if (user) {
      user.subscriptionStatus = 'canceled';
      await user.save();
    }

    console.log('✅ Subscription cancelled in database');

  } catch (error) {
    console.error('Handle Subscription Cancelled Error:', error);
  }
}

// Subscription Suspended
async function handleSubscriptionSuspended(event) {
  try {
    console.log('=== SUBSCRIPTION SUSPENDED ===');
    
    const subscriptionData = event.resource;
    
    const subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionData.id
    });

    if (!subscription) {
      console.error('Subscription not found:', subscriptionData.id);
      return;
    }

    subscription.status = 'past_due';
    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    if (user) {
      user.subscriptionStatus = 'past_due';
      await user.save();
    }

    console.log('✅ Subscription suspended in database');

  } catch (error) {
    console.error('Handle Subscription Suspended Error:', error);
  }
}

// Subscription Expired
async function handleSubscriptionExpired(event) {
  try {
    console.log('=== SUBSCRIPTION EXPIRED ===');
    
    const subscriptionData = event.resource;
    
    const subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionData.id
    });

    if (!subscription) {
      console.error('Subscription not found:', subscriptionData.id);
      return;
    }

    subscription.status = 'expired';
    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    if (user) {
      user.subscriptionStatus = 'expired';
      await user.save();
    }

    console.log('✅ Subscription expired in database');

  } catch (error) {
    console.error('Handle Subscription Expired Error:', error);
  }
}

// Payment Completed
async function handlePaymentCompleted(event) {
  try {
    console.log('=== PAYMENT COMPLETED ===');
    
    const saleData = event.resource;
    const subscriptionId = saleData.billing_agreement_id;

    if (!subscriptionId) {
      console.log('No subscription ID in payment');
      return;
    }

    const subscription = await Subscription.findOne({
      paypalSubscriptionId: subscriptionId
    });

    if (subscription) {
      subscription.status = 'active';
      await subscription.save();

      const user = await User.findById(subscription.user);
      if (user) {
        user.subscriptionStatus = 'active';
        await user.save();
      }

      console.log('✅ Payment completed, subscription updated');
    }

  } catch (error) {
    console.error('Handle Payment Completed Error:', error);
  }
}

// Payment Refunded
async function handlePaymentRefunded(event) {
  try {
    console.log('=== PAYMENT REFUNDED ===');
    
    const refundData = event.resource;
    
    // Log for manual review
    console.log('Refund processed:', {
      refundId: refundData.id,
      amount: refundData.amount,
      saleId: refundData.sale_id
    });

    // You might want to notify user or take other actions

  } catch (error) {
    console.error('Handle Payment Refunded Error:', error);
  }
}

export default {
  handlePayPalWebhook
};