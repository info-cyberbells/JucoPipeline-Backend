// middleware/subscription.middleware.js
import Subscription from "../models/subscription.model.js";

/**
 * Middleware to check if user has an active subscription
 * Use this on routes that require paid subscription
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;

    // Super admin and players don't need subscription
    if (userRole === "superAdmin" || userRole === "player") {
      return next();
    }

    // Check if coach or scout has active subscription
    if (userRole === "coach" || userRole === "scout") {
      const subscription = await Subscription.findOne({
        user: userId,
        status: { $in: ["active", "trialing"] }
      });

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to access this resource",
          requiresSubscription: true
        });
      }

      // Check if subscription is past due
      if (subscription.status === "past_due") {
        return res.status(403).json({
          success: false,
          message: "Your subscription payment is past due. Please update your payment method.",
          requiresPaymentUpdate: true
        });
      }

      // Attach subscription to request for further use
      req.subscription = subscription;
      return next();
    }

    // Unknown role
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  } catch (error) {
    console.error("Subscription middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking subscription status"
    });
  }
};

/**
 * Middleware to check subscription for specific roles
 */
export const requireSubscriptionForRoles = (roles = []) => {
  return async (req, res, next) => {
    const userRole = req.user.role;

    // If user's role is not in the required roles list, skip subscription check
    if (!roles.includes(userRole)) {
      return next();
    }

    // Otherwise, check subscription
    return requireActiveSubscription(req, res, next);
  };
};

/**
 * Check if user can access premium features
 */
export const canAccessPremiumFeatures = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;

    // Players and super admins have access
    if (userRole === "player" || userRole === "superAdmin") {
      req.hasPremiumAccess = true;
      return next();
    }

    // Check subscription for coaches and scouts
    const subscription = await Subscription.findOne({
      user: userId,
      status: { $in: ["active", "trialing"] }
    });

    req.hasPremiumAccess = !!subscription;
    req.subscription = subscription;

    next();
  } catch (error) {
    console.error("Premium access check error:", error);
    req.hasPremiumAccess = false;
    next();
  }
};