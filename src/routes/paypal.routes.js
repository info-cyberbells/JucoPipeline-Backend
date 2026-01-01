import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getPayPalPlans, createPayPalSubscription, capturePayPalSubscription, getPayPalSubscriptionStatus, cancelPayPalSubscription, getPayPalTransactionHistory } from "../controllers/paypal.controller.js";

const router = express.Router();

// Get subscription plans
router.get("/paypal/plans", authenticate, getPayPalPlans);

// Create PayPal subscription
router.post("/paypal/create-subscription", authenticate, createPayPalSubscription);

// Capture subscription after approval
router.post("/paypal/capture-subscription", authenticate, capturePayPalSubscription);

// Get subscription status
router.get("/paypal/subscription-status", authenticate, getPayPalSubscriptionStatus);

// Cancel subscription
router.post("/paypal/cancel-subscription", authenticate, cancelPayPalSubscription);

// Get transaction history
router.get("/paypal/transaction-history", authenticate, getPayPalTransactionHistory);

export default router;