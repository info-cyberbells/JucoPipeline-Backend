import express from "express";
import { 
  getSubscriptionPlans, 
  createCheckoutSession,
  getSubscriptionStatus, 
  cancelSubscription,
  reactivateSubscription,
  getPaymentHistory,
  updatePaymentMethod,
  verifySession
} from "../controllers/payment.controller.js";
import { handleOutsetaWebhook } from "../controllers/webhookHandler.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/plans", getSubscriptionPlans);
router.post("/webhooks/outseta", express.json(), handleOutsetaWebhook);

// Protected routes
router.post("/create-checkout-session", createCheckoutSession);
router.get("/subscription-status", authenticate, getSubscriptionStatus);
router.post("/cancel-subscription", authenticate, cancelSubscription);
router.post("/reactivate-subscription", authenticate, reactivateSubscription);
router.get("/payment-history", authenticate, getPaymentHistory);
router.post("/update-payment-method", authenticate, updatePaymentMethod);
router.get("/verify-session", verifySession);

export default router;