import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = {
  // Coach Plans
  coach_yearly: {
    name: "4 YEAR COACH",
    priceId: process.env.STRIPE_COACH_YEARLY_PRICE_ID,
    price: 99.00,
    interval: "year",
    features: [
      "Full Access to Elite Player Database",
      "Direct Contact with top players",
      "Advanced Scouting and Video",
      "Planning for better and quicker recruitment results"
    ]
  },
  coach_monthly: {
    name: "MONTHLY COACH",
    priceId: process.env.STRIPE_COACH_MONTHLY_PRICE_ID,
    price: 10.00,
    interval: "month",
    features: [
      "Full Access to Elite Player Database",
      "Direct Contact with top players",
      "Advanced Scouting and Video",
      "Planning for better and quicker recruitment results"
    ]
  },

  // Scout Plans
  scout_yearly: {
    name: "MLD SCOUT",
    priceId: process.env.STRIPE_SCOUT_YEARLY_PRICE_ID,
    price: 99.00,
    interval: "year",
    features: [
      "Unlimited Access to elite players",
      "Planning for better and quicker recruitment results",
      "Access to videos and live events"
    ]
  },
  scout_monthly: {
    name: "MONTHLY SCOUT",
    priceId: process.env.STRIPE_SCOUT_MONTHLY_PRICE_ID,
    price: 10.00,
    interval: "month",
    features: [
      "Unlimited Access to elite players",
      "Planning for better and quicker recruitment results",
      "Access to videos and live events"
    ]
  }
};

export default stripe;