import { PAYPAL_SUBSCRIPTION_PLANS, paypalAPI, getPayPalBaseURL } from "../config/paypal.config.js";
import stripe, { SUBSCRIPTION_PLANS } from "../config/stripe.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";

// GET PAYPAL PLANS
export const getPayPalPlansOLLLDDDDDD = async (req, res) => {
  try {
    const { role } = req.query; 
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Support both id and _id
    const userId = authUser.id || authUser._id;
    // const role = authUser.role;

    // role must be coach or scout
    if (!role || (role !== "coach" && role !== "scout")) {
      return res.status(400).json({
        success: false,
        message: "Only coach or scout can view PayPal plans",
      });
    }

    const rolePlans = {};
    
    Object.entries(PAYPAL_SUBSCRIPTION_PLANS).forEach(([key, value]) => {
      if (key.startsWith(role)) {
        const interval = key.includes("yearly") ? "yearly" : "monthly";
        rolePlans[interval] = value;
      }
    });

    return res.json({
      success: true,
      plans: rolePlans,
      paymentMethod: "paypal",
      userId
    });
  } catch (error) {
    console.error("Get PayPal Plans Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: error.message
    });
  }
};

// GET PAYPAL PLANS V1
export const getPayPalPlans = async (req, res) => {
  try {
    const { role, provider = "default" } = req.query;

    // validate role
    if (role && role !== "coach" && role !== "scout") {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Allowed values: coach, scout",
      });
    }

    // select plan source
    let PLAN_SOURCE;

    if (provider === "paypal") {
      PLAN_SOURCE = PAYPAL_SUBSCRIPTION_PLANS;
    } else {
      PLAN_SOURCE = SUBSCRIPTION_PLANS; // default / stripe
    }

    let plans = {};

    if (role === "coach") {
      plans = {
        monthly: {
          ...PLAN_SOURCE.coach_monthly,
          planId: "coach_monthly",
        },
        yearly: {
          ...PLAN_SOURCE.coach_yearly,
          planId: "coach_yearly",
        },
      };
    } else if (role === "scout") {
      plans = {
        monthly: {
          ...PLAN_SOURCE.scout_monthly,
          planId: "scout_monthly",
        },
        yearly: {
          ...PLAN_SOURCE.scout_yearly,
          planId: "scout_yearly",
        },
      };
    } else {
      // all roles
      plans = {
        coach: {
          monthly: { ...PLAN_SOURCE.coach_monthly, planId: "coach_monthly" },
          yearly: { ...PLAN_SOURCE.coach_yearly, planId: "coach_yearly" },
        },
        scout: {
          monthly: { ...PLAN_SOURCE.scout_monthly, planId: "scout_monthly" },
          yearly: { ...PLAN_SOURCE.scout_yearly, planId: "scout_yearly" },
        },
      };
    }

    return res.json({
      success: true,
      message: "Subscription plans retrieved successfully",
      provider,
      plans,
    });
  } catch (error) {
    console.error("Get Plans Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve plans",
      error: error.message,
    });
  }
};



// CREATE PAYPAL SUBSCRIPTION
export const createPayPalSubscriptionOLLLDDDDINDEXISSUE = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { plan } = req.body;

    // Validate plan
    if (!PAYPAL_SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify role matches plan
    const planRole = plan.startsWith("coach") ? "coach" : "scout";
    if (user.role !== planRole) {
      return res.status(403).json({
        success: false,
        message: `This plan is for ${planRole}s only`
      });
    }

    // Check existing active subscription
    const existingSubscription = await Subscription.findOne({
      user: userId,
      status: { $in: ["active", "trialing"] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription"
      });
    }

    const planConfig = PAYPAL_SUBSCRIPTION_PLANS[plan];
    // console.log('planConfig',planConfig)
    // Create PayPal subscription
    const subscriptionData = {
      plan_id: planConfig.planId,
      application_context: {
        brand_name: "JucoPipeline",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: `${process.env.FRONTEND_URL}/payment/success?provider=paypal`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      },
      custom_id: userId.toString(),
      plan: {
        billing_cycles: []
      }
    };
    // console.log('+++++++++++++++');
    // console.log('subscriptionData',subscriptionData)
    const subscription = await paypalAPI('/v1/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscriptionData)
    });

    // Find approval URL
    const approvalUrl = subscription.links.find(link => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL returned from PayPal');
    }

    res.json({
      success: true,
      message: "PayPal subscription created successfully",
      subscriptionId: subscription.id,
      approvalUrl: approvalUrl,
      plan: {
        name: planConfig.name,
        price: planConfig.price,
        interval: planConfig.interval,
        features: planConfig.features
      },
      provider: "paypal"
    });

  } catch (error) {
    console.error("Create PayPal Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create PayPal subscription",
      error: error.message
    });
  }
};

export const createPayPalSubscription = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { plan } = req.body;

    // Validate plan
    if (!PAYPAL_SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify role matches plan
    const planRole = plan.startsWith("coach") ? "coach" : "scout";
    if (user.role !== planRole) {
      return res.status(403).json({
        success: false,
        message: `This plan is for ${planRole}s only`
      });
    }

    // Check existing active subscription
    const existingSubscription = await Subscription.findOne({
      user: userId,
      status: { $in: ["active", "trialing"] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription"
      });
    }

    const planConfig = PAYPAL_SUBSCRIPTION_PLANS[plan];

    //--------------------------------------
    // 1) Create PayPal Subscription
    //--------------------------------------

    const subscriptionData = {
      plan_id: planConfig.planId,
      application_context: {
        brand_name: "JucoPipeline",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: `${process.env.FRONTEND_URL}/payment/success?provider=paypal`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      },
      custom_id: userId.toString()
    };

    const subscription = await paypalAPI("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify(subscriptionData)
    });

    const approvalUrl = subscription.links.find(link => link.rel === "approve")?.href;

    if (!approvalUrl) throw new Error("No approval URL from PayPal");

    //--------------------------------------
    // 2) Create PENDING subscription in DB
    //--------------------------------------

    await Subscription.create({
      user: userId,
      provider: "paypal",
      paypalSubscriptionId: subscription.id,
      planId: planConfig.planId,
      planName: planConfig.name,
      price: planConfig.price,
      interval: planConfig.interval,
      status: "pending", // waiting for PayPal approval
      startDate: null,
      endDate: null
    });

    //--------------------------------------

    return res.json({
      success: true,
      message: "PayPal subscription created successfully",
      subscriptionId: subscription.id,
      approvalUrl,
      plan: {
        name: planConfig.name,
        price: planConfig.price,
        interval: planConfig.interval,
        features: planConfig.features
      },
      provider: "paypal"
    });

  } catch (error) {
    console.error("Create PayPal Subscription Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create PayPal subscription",
      error: error.message
    });
  }
};


// CAPTURE PAYPAL SUBSCRIPTION (After Approval)
export const capturePayPalSubscription = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { subscriptionId, plan } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required"
      });
    }

    // Get subscription details from PayPal
    const paypalSubscription = await paypalAPI(
      `/v1/billing/subscriptions/${subscriptionId}`,
      { method: 'GET' }
    );

    if (paypalSubscription.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: "Subscription is not active yet"
      });
    }

    const user = await User.findById(userId);
    const planConfig = PAYPAL_SUBSCRIPTION_PLANS[plan];

    // Save subscription to database
    const subscription = await Subscription.create({
      user: userId,
      paypalSubscriptionId: paypalSubscription.id,
      plan: plan,
      status: paypalSubscription.status.toLowerCase(),
      currentPeriodStart: new Date(paypalSubscription.start_time),
      currentPeriodEnd: new Date(paypalSubscription.billing_info.next_billing_time),
      paymentProvider: "paypal"
    });

    // Update user
    user.subscriptionStatus = "active";
    user.subscriptionPlan = plan;
    user.subscriptionEndDate = new Date(paypalSubscription.billing_info.next_billing_time);
    user.paypalSubscriptionId = paypalSubscription.id;
    await user.save();

    res.json({
      success: true,
      message: "Subscription activated successfully",
      subscription: {
        id: subscription._id,
        paypalSubscriptionId: paypalSubscription.id,
        plan: plan,
        planName: planConfig.name,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error("Capture PayPal Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to capture subscription",
      error: error.message
    });
  }
};

// GET PAYPAL SUBSCRIPTION STATUS
export const getPayPalSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const subscription = await Subscription.findOne({
      user: userId,
      paymentProvider: "paypal"
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        success: true,
        message: "No PayPal subscription found",
        subscription: null,
        hasActiveSubscription: false
      });
    }

    const planConfig = PAYPAL_SUBSCRIPTION_PLANS[subscription.plan];

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        paypalSubscriptionId: subscription.paypalSubscriptionId,
        plan: subscription.plan,
        planName: planConfig?.name || subscription.plan,
        price: planConfig?.price || 0,
        interval: planConfig?.interval?.toLowerCase() || "month",
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        features: planConfig?.features || [],
        provider: "paypal"
      },
      hasActiveSubscription: ["active", "trialing"].includes(subscription.status)
    });

  } catch (error) {
    console.error("Get PayPal Subscription Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get subscription status",
      error: error.message
    });
  }
};

// CANCEL PAYPAL SUBSCRIPTION
export const cancelPayPalSubscriptionOLLLLDDDDDD = async (req, res) => {
  try {
    // const userId = req.user._id || req.user.id;
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = authUser.id || authUser._id;
    const subscription = await Subscription.findOne({
      user: userId,
      paymentProvider: "paypal",
      status: "active"
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active PayPal subscription found"
      });
    }
    // Cancel in PayPal
    await paypalAPI(
      `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: "Customer requested cancellation"
        })
      }
    );

    // Update in database
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    // Update user
    const user = await User.findById(userId);
    user.subscriptionStatus = "canceled";
    await user.save();

    res.json({
      success: true,
      message: "Subscription canceled successfully. You can use it until the end of the current period.",
      subscription: {
        id: subscription._id,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error("Cancel PayPal Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
};

export const cancelPayPalSubscription = async (req, res) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = authUser.id || authUser._id;

    const subscription = await Subscription.findOne({
      user: userId,
      paymentProvider: "paypal"
    }).sort({ createdAt: -1 }); // Get most recent

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No PayPal subscription found"
      });
    }

    // Check if subscription exists in PayPal
    let paypalSubscription;
    try {
      paypalSubscription = await paypalAPI(
        `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}`,
        { method: 'GET' }
      );
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found in PayPal",
        error: error.message
      });
    }

    // Check if subscription can be cancelled
    const cancellableStatuses = ['ACTIVE', 'SUSPENDED'];
    if (!cancellableStatuses.includes(paypalSubscription.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel subscription. Current status: ${paypalSubscription.status}. Only ACTIVE or SUSPENDED subscriptions can be cancelled.`,
        currentStatus: paypalSubscription.status,
        allowedStatuses: cancellableStatuses
      });
    }

    // Cancel in PayPal
    await paypalAPI(
      `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: "Customer requested cancellation"
        })
      }
    );

    // Update in database
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    // Update user
    const user = await User.findById(userId);
    user.subscriptionStatus = "canceled";
    await user.save();

    res.json({
      success: true,
      message: "Subscription canceled successfully. You can use it until the end of the current period.",
      subscription: {
        id: subscription._id,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error("Cancel PayPal Subscription Error:", error);
    
    // Handle specific PayPal errors
    if (error.message.includes('SUBSCRIPTION_STATUS_INVALID')) {
      return res.status(400).json({
        success: false,
        message: "Subscription cannot be cancelled in its current state. It may not be active yet."
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
};

// GET PAYPAL TRANSACTION HISTORY
export const getPayPalTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { limit = 20 } = req.query;

    const subscription = await Subscription.findOne({
      user: userId,
      paymentProvider: "paypal"
    });

    if (!subscription || !subscription.paypalSubscriptionId) {
      return res.json({
        success: true,
        payments: [],
        message: "No PayPal subscription found"
      });
    }

    // Get transactions from PayPal
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // Last 1 year
    const endDate = new Date();

    const transactions = await paypalAPI(
      `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/transactions?` +
      `start_time=${startDate.toISOString()}&end_time=${endDate.toISOString()}`,
      { method: 'GET' }
    );

    const formattedPayments = (transactions.transactions || [])
      .slice(0, parseInt(limit))
      .map(txn => ({
        id: txn.id,
        date: new Date(txn.time),
        description: `PayPal Subscription Payment`,
        amount: parseFloat(txn.amount_with_breakdown?.gross_amount?.value || 0),
        currency: txn.amount_with_breakdown?.gross_amount?.currency_code || 'USD',
        status: txn.status.toLowerCase(),
        provider: "paypal"
      }));

    res.json({
      success: true,
      payments: formattedPayments,
      count: formattedPayments.length
    });

  } catch (error) {
    console.error("Get PayPal Transaction History Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get transaction history",
      error: error.message
    });
  }
};