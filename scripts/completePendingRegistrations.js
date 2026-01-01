// scripts/completePendingRegistrations.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import PendingRegistration from "../models/pendingRegistration.model.js";
import Subscription from "../models/subscription.model.js";
import stripe from "../config/stripe.js";

dotenv.config();

const completePendingRegistration = async (email) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const pendingReg = await PendingRegistration.findOne({ email });
    
    if (!pendingReg) {
      console.log("No pending registration found");
      return;
    }

    if (!pendingReg.stripeSessionId) {
      console.log("No Stripe session found");
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(
      pendingReg.stripeSessionId,
      { expand: ["subscription"] }
    );

    if (session.payment_status !== "paid") {
      console.log("Payment not completed");
      return;
    }

    const stripeSubscription = session.subscription;

    // Create user
    const user = await User.create({
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      email: pendingReg.email,
      password: pendingReg.password,
      role: pendingReg.role,
      state: pendingReg.state,
      profileImage: pendingReg.profileImage,
      registrationStatus: "approved",
      stripeCustomerId: session.customer,
      subscriptionStatus: stripeSubscription.status,
      subscriptionPlan: pendingReg.plan,
      subscriptionEndDate: new Date(stripeSubscription.current_period_end * 1000),
      ...(pendingReg.role === "scout" ? {
        team: pendingReg.teamId,
        jobTitle: pendingReg.jobTitle
      } : {
        school: pendingReg.school,
        division: pendingReg.division,
        conference: pendingReg.conference
      })
    });

    // Create subscription
    await Subscription.create({
      user: user._id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: pendingReg.plan,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      paymentProvider: "stripe"
    });

    // Mark as completed
    pendingReg.status = "completed";
    await pendingReg.save();

    console.log("✅ Registration completed for:", email);
    
    mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    mongoose.disconnect();
  }
};

// Run with: node scripts/completePendingRegistrations.js
completePendingRegistration("coach.john@example.com");