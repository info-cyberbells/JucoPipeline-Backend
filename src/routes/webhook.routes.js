import express from "express";
import { handleStripeWebhook } from "../controllers/webhookHandler.controller.js";

const router = express.Router();

// Stripe webhook endpoint
// IMPORTANT: This route should use express.raw() middleware, not express.json()
router.post("/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

export default router;