import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import PendingRegistration from "../models/pendingRegistration.model.js";
import Subscription from "../models/subscription.model.js";
import { paypalAPI } from "../config/paypal.config.js";

dotenv.config();

const fixPendingRegistration = async (pendingRegId) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const pendingReg = await PendingRegistration.findById(pendingRegId);
    
    if (!pendingReg) {
      console.log("❌ Pending registration not found");
      mongoose.disconnect();
      return;
    }

    console.log('Found pending registration:', {
      id: pendingReg._id,
      email: pendingReg.email,
      role: pendingReg.role,
      paymentProvider: pendingReg.paymentProvider
    });

    if (!pendingReg.paypalSubscriptionId) {
      console.log("❌ No PayPal subscription ID");
      mongoose.disconnect();
      return;
    }

    // Get subscription from PayPal
    const paypalSubscription = await paypalAPI(
      `/v1/billing/subscriptions/${pendingReg.paypalSubscriptionId}`,
      { method: 'GET' }
    );

    console.log('PayPal Status:', paypalSubscription.status);

    if (paypalSubscription.status !== 'ACTIVE') {
      console.log("⚠️ PayPal subscription not active:", paypalSubscription.status);
      mongoose.disconnect();
      return;
    }

    // Parse dates
    const nextBillingTime = paypalSubscription.billing_info?.next_billing_time;
    const startTime = paypalSubscription.start_time;

    const subscriptionEndDate = nextBillingTime 
      ? new Date(nextBillingTime)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscriptionStartDate = startTime
      ? new Date(startTime)
      : new Date();

    // Build user data
    const userData = {
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      email: pendingReg.email,
      password: pendingReg.password,
      role: pendingReg.role,
      state: pendingReg.state || null,
      profileImage: pendingReg.profileImage || null,
      registrationStatus: "approved",
      paypalSubscriptionId: paypalSubscription.id,
      subscriptionStatus: "active",
      subscriptionPlan: pendingReg.plan,
      subscriptionEndDate: subscriptionEndDate
    };

    // Role-specific fields with defaults
    if (pendingReg.role === "scout") {
      userData.team = pendingReg.teamId || null;
      userData.jobTitle = pendingReg.jobTitle || "Scout"; // Default
      console.log('Scout fields:', {
        team: userData.team,
        jobTitle: userData.jobTitle
      });
    } else if (pendingReg.role === "coach") {
      userData.school = pendingReg.school || "Unknown School";
      userData.division = pendingReg.division || "Division I";
      userData.conference = pendingReg.conference || "Unknown Conference";
      console.log('Coach fields:', {
        school: userData.school,
        division: userData.division,
        conference: userData.conference
      });
    }

    console.log('Creating user...');
    const user = await User.create(userData);
    console.log('✅ User created:', user._id);

    // Create subscription
    await Subscription.create({
      user: user._id,
      paypalSubscriptionId: paypalSubscription.id,
      plan: pendingReg.plan,
      status: "active",
      currentPeriodStart: subscriptionStartDate,
      currentPeriodEnd: subscriptionEndDate,
      paymentProvider: "paypal"
    });
    console.log('✅ Subscription created');

    // Mark as completed
    pendingReg.status = "completed";
    await pendingReg.save();
    console.log('✅ Pending registration marked complete');

    console.log('🎉 Registration completed successfully!');
    console.log('User can now login with:', pendingReg.email);
    
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
};

// Run: node scripts/fixPayPalPendingRegistration.js 694267c971de32dc60745cf7
const pendingRegId = process.argv[2] || "694267c971de32dc60745cf7";
fixPendingRegistration(pendingRegId);