import express from "express";
import { handlePayPalWebhook } from "../controllers/paypal-webhook.controller.js";

const router = express.Router();

// PayPal webhook endpoint
// IMPORTANT: This route should use express.json() for webhook body parsing
router.post("/paypal", express.json(), handlePayPalWebhook);

export default router;