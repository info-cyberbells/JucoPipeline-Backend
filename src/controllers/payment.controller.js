import outseta from "../config/outseta.config.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";

// ============================================
// GET SUBSCRIPTION PLANS (No role restrictions)
// ============================================
export const getSubscriptionPlansOLDNOTINUSE = async (req, res) => {
  try {
    const outsetaPlans = await outseta.getPlans();

    const formattedPlans = outsetaPlans.items.map(plan => ({
      planId: plan.Uid,
      name: plan.Name,
      price: plan.PlanAmount,
      interval: plan.BillingRenewalTerm === 12 ? 'year' : 'month',
      billingRenewalTerm: plan.BillingRenewalTerm,
      description: plan.Description,
      features: plan.PlanFamilyFeatures || []
    }));

    return res.json({
      success: true,
      message: "All subscription plans retrieved successfully",
      provider: "outseta",
      plans: formattedPlans
    });

  } catch (error) {
    console.error("Get Plans Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve plans",
      error: error.message
    });
  }
};

export const getSubscriptionPlans = async (req, res) => {
  try {
    const outsetaPlans = await outseta.getPlans();

    const ALLOWED_PLAN_NAMES = ['Coach Plan', 'Scout Plan'];
    const formattedPlans = [];

    outsetaPlans.forEach(plan => {
      // ❌ Skip inactive plans
      if (!plan.IsActive) return;

      // ❌ Skip unwanted plans
      if (!ALLOWED_PLAN_NAMES.includes(plan.Name)) return;

      // Monthly pricing
      if (plan.MonthlyRate > 0) {
        formattedPlans.push({
          planId: plan.Uid,
          name: plan.Name,
          interval: 'month',
          price: plan.MonthlyRate,
          currency: 'USD',
          description: plan.Description
        });
      }

      // Annual pricing
      if (plan.AnnualRate > 0) {
        formattedPlans.push({
          planId: plan.Uid,
          name: plan.Name,
          interval: 'year',
          price: plan.AnnualRate,
          currency: 'USD',
          description: plan.Description
        });
      }
    });

    return res.json({
      success: true,
      message: "Filtered subscription plans retrieved successfully",
      provider: "outseta",
      plans: formattedPlans
    });

  } catch (error) {
    console.error("Get Plans Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve plans",
      error: error.message
    });
  }
};

// ============================================
// CREATE CHECKOUT SESSION (No authentication on Outseta side)
// ============================================
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { plan } = req.body; // Plan UID from Outseta

    // Get user from YOUR database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found"
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
        message: "You already have an active subscription."
      });
    }

    // Validate plan exists in Outseta
    let planDetails;
    try {
      planDetails = await outseta.getPlan(plan);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }

    // Create or update person in Outseta (for billing purposes only)
    let outsetaPerson;
    try {
      outsetaPerson = await outseta.createOrUpdatePerson({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        state: user.state
      });

      // Save Outseta IDs to YOUR user model (for reference)
      if (!user.outsetaPersonUid) {
        user.outsetaPersonUid = outsetaPerson.Uid;
        user.outsetaAccountUid = outsetaPerson.Account.Uid;
        await user.save();
      }

      console.log(`✅ Synced user to Outseta: ${outsetaPerson.Uid}`);
    } catch (error) {
      console.error("Error syncing user to Outseta:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to sync user for billing"
      });
    }

    // Create Stripe Checkout Session via Outseta API
    try {
      const checkoutSession = await outseta.createStripeCheckoutSession(
        outsetaPerson.Account.Uid,
        plan,
        `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        `${process.env.FRONTEND_URL}/payment/cancel`
      );

      res.json({
        success: true,
        message: "Checkout session created successfully",
        sessionUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
        plan: {
          uid: plan,
          name: planDetails.Name,
          price: planDetails.PlanAmount,
          interval: planDetails.BillingRenewalTerm === 12 ? 'year' : 'month'
        }
      });

    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create checkout session"
      });
    }

  } catch (error) {
    console.error("Create Checkout Session Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message
    });
  }
};

// ============================================
// GET SUBSCRIPTION STATUS
// ============================================
export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.outsetaAccountUid) {
      return res.json({
        success: true,
        message: "No subscription found",
        subscription: null,
        hasActiveSubscription: false
      });
    }

    // Get subscriptions from Outseta
    const subscriptions = await outseta.getAccountSubscriptions(user.outsetaAccountUid);

    const activeSubscription = subscriptions.find(sub => 
      sub.SubscriptionStatus === 'Active' || sub.SubscriptionStatus === 'Trialing'
    );

    if (!activeSubscription) {
      return res.json({
        success: true,
        message: "No active subscription",
        subscription: null,
        hasActiveSubscription: false
      });
    }

    res.json({
      success: true,
      message: "Subscription status retrieved successfully",
      subscription: {
        uid: activeSubscription.Uid,
        plan: activeSubscription.Plan.Name,
        amount: activeSubscription.BillingAmount,
        status: activeSubscription.SubscriptionStatus,
        currentPeriodStart: activeSubscription.CurrentPeriodStart,
        currentPeriodEnd: activeSubscription.CurrentPeriodEnd,
        renewalDate: activeSubscription.RenewalDate,
        cancelAtPeriodEnd: !!activeSubscription.CancellationDate,
        canceledAt: activeSubscription.CancellationDate
      },
      hasActiveSubscription: true
    });

  } catch (error) {
    console.error("Get Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription",
      error: error.message
    });
  }
};

// ============================================
// CANCEL SUBSCRIPTION
// ============================================
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.outsetaAccountUid) {
      return res.status(400).json({
        success: false,
        message: "No subscription found"
      });
    }

    const subscriptions = await outseta.getAccountSubscriptions(user.outsetaAccountUid);
    const activeSubscription = subscriptions.find(sub => 
      sub.SubscriptionStatus === 'Active'
    );

    if (!activeSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription to cancel"
      });
    }

    // Cancel at period end
    const canceledSubscription = await outseta.cancelSubscription(
      activeSubscription.Uid,
      activeSubscription.RenewalDate
    );

    // Update YOUR database
    await Subscription.findOneAndUpdate(
      { user: userId, outsetaSubscriptionUid: activeSubscription.Uid },
      { 
        cancelAtPeriodEnd: true,
        canceledAt: new Date()
      }
    );

    res.json({
      success: true,
      message: "Subscription will be canceled at the end of the billing period",
      subscription: {
        status: canceledSubscription.SubscriptionStatus,
        renewalDate: canceledSubscription.RenewalDate,
        cancellationDate: canceledSubscription.CancellationDate
      }
    });

  } catch (error) {
    console.error("Cancel Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
};

// ============================================
// REACTIVATE SUBSCRIPTION
// ============================================
export const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.outsetaAccountUid) {
      return res.status(400).json({
        success: false,
        message: "No subscription found"
      });
    }

    const subscriptions = await outseta.getAccountSubscriptions(user.outsetaAccountUid);
    const canceledSubscription = subscriptions.find(sub => 
      sub.CancellationDate && sub.SubscriptionStatus === 'Active'
    );

    if (!canceledSubscription) {
      return res.status(400).json({
        success: false,
        message: "No canceled subscription found to reactivate"
      });
    }

    // Remove cancellation
    const reactivatedSubscription = await outseta.updateSubscription(
      canceledSubscription.Uid,
      { CancellationDate: null }
    );

    // Update YOUR database
    await Subscription.findOneAndUpdate(
      { user: userId, outsetaSubscriptionUid: canceledSubscription.Uid },
      { 
        cancelAtPeriodEnd: false,
        canceledAt: null
      }
    );

    res.json({
      success: true,
      message: "Subscription reactivated successfully",
      subscription: {
        status: reactivatedSubscription.SubscriptionStatus,
        renewalDate: reactivatedSubscription.RenewalDate
      }
    });

  } catch (error) {
    console.error("Reactivate Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reactivate subscription",
      error: error.message
    });
  }
};

// ============================================
// GET PAYMENT HISTORY
// ============================================
export const getPaymentHistoryOLLDINVOCIE = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { limit = 10 } = req.query;
    console.log('userId',userId);
    const user = await User.findById(userId);
    if (!user || !user.outsetaAccountUid) {
      return res.json({
        success: true,
        message: "No payment history found",
        payments: []
      });
    }

    const invoices = await outseta.getInvoices(user.outsetaAccountUid, parseInt(limit));
    console.log('invoices',invoices)
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.Uid,
      amount: invoice.Amount,
      currency: 'USD',
      status: invoice.InvoiceStatus,
      date: invoice.InvoiceDate,
      invoiceUrl: invoice.InvoicePdfUrl,
      description: invoice.InvoiceDisplayName || "Subscription payment"
    }));

    res.json({
      success: true,
      message: "Payment history retrieved successfully",
      payments: formattedInvoices
    });

  } catch (error) {
    console.error("Get Payment History Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: error.message
    });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { limit = 10 } = req.query;
    
    console.log('userId', userId);

    // Get user's subscription from MongoDB
    const subscription = await Subscription.findOne({ 
      user: userId,
      paymentProvider: 'outseta'
    }).populate('user', 'email name');

    // If no subscription found
    if (!subscription) {
      return res.json({
        success: true,
        message: "No subscription found",
        subscription: null,
        payments: []
      });
    }

    console.log('subscription', subscription);

    // Optional: Still fetch invoices from Outseta if needed
    let invoices = [];
    try {
      if (subscription.outsetaAccountUid) {
        invoices = await outseta.getInvoices(
          subscription.outsetaAccountUid, 
          parseInt(limit)
        );
      }
    } catch (error) {
      console.error('Error fetching invoices from Outseta:', error);
      // Continue even if invoice fetch fails
    }

    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.Uid,
      amount: invoice.Amount,
      currency: 'USD',
      status: invoice.InvoiceStatus,
      date: invoice.InvoiceDate,
      invoiceUrl: invoice.InvoicePdfUrl,
      description: invoice.InvoiceDisplayName || "Subscription payment"
    }));

    // Format subscription data
    const formattedSubscription = {
      id: subscription._id,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      paymentProvider: subscription.paymentProvider,
      outsetaSubscriptionUid: subscription.outsetaSubscriptionUid,
      outsetaAccountUid: subscription.outsetaAccountUid,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      
      // Calculate days remaining
      daysRemaining: Math.ceil(
        (new Date(subscription.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)
      ),
      
      // Check if subscription is active
      isActive: subscription.status === 'active' && 
                new Date(subscription.currentPeriodEnd) > new Date(),
      
      // Check if in trial
      isTrialing: subscription.status === 'trialing' &&
                  subscription.trialEnd &&
                  new Date(subscription.trialEnd) > new Date()
    };

    res.json({
      success: true,
      message: "Subscription and payment history retrieved successfully",
      subscription: formattedSubscription,
      payments: formattedInvoices
    });

  } catch (error) {
    console.error("Get Payment History Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: error.message
    });
  }
};

// ============================================
// UPDATE PAYMENT METHOD (Stripe Billing Portal)
// ============================================
export const updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.outsetaAccountUid) {
      return res.status(400).json({
        success: false,
        message: "No account found"
      });
    }

    // Get Stripe Billing Portal URL via Outseta
    const portalUrl = await outseta.getStripePortalUrl(
      user.outsetaAccountUid,
      `${process.env.FRONTEND_URL}/settings/billing`
    );

    res.json({
      success: true,
      message: "Billing portal session created",
      url: portalUrl
    });

  } catch (error) {
    console.error("Update Payment Method Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create billing portal session",
      error: error.message
    });
  }
};

// ============================================
// VERIFY SESSION (After successful payment)
// ============================================
export const verifySession = async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required"
      });
    }

    // In this flow, Outseta webhook will handle updating your database
    // This endpoint just confirms the session exists
    res.json({
      success: true,
      message: "Payment session completed. Your subscription will be activated shortly."
    });

  } catch (error) {
    console.error("Verify Session Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify session",
      error: error.message
    });
  }
};