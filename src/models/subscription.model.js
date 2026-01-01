import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  plan: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing', 'expired', 'incomplete'],
    default: 'active'
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  
  // Payment provider
  paymentProvider: {
    type: String,
    enum: ['stripe', 'paypal', 'outseta'], // ✅ Added 'outseta'
    required: true,
    default: 'stripe'
  },
  
  // Stripe specific fields
  stripeCustomerId: {
    type: String,
    trim: true
  },
  stripeSubscriptionId: {
    type: String,
    trim: true,
    sparse: true,
  },
  stripePriceId: {
    type: String,
    trim: true
  },
  
  // PayPal specific fields
  paypalSubscriptionId: {
    type: String,
    trim: true
  },
  
  // Outseta specific fields
  outsetaSubscriptionUid: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  outsetaAccountUid: {
    type: String,
    trim: true,
    sparse: true
  }
  
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indexes
subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 }, { sparse: true });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ paypalSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ outsetaSubscriptionUid: 1 }, { unique: true, sparse: true });

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;