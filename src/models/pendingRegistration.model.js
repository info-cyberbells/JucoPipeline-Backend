import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const pendingRegistrationSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String, // Hashed
  role: { type: String, enum: ["scout", "coach"] },
  profileImage: String,

  // Role-specific fields
  teamId: mongoose.Schema.Types.ObjectId,
  jobTitle: String,
  school: String,
  division: String,
  conference: String,
  state: String,

  // Payment info
  paymentProvider: { type: String, enum: ["stripe", "paypal", "outseta"] },
  plan: String,

  // Stripe specific
  stripeCustomerId: String,
  stripeSessionId: String,

  // PayPal specific
  paypalSubscriptionId: String,

  status: {
    type: String,
    enum: ["pending_payment", "payment_processing", "completed", "failed"],
    default: "pending_payment"
  },
  outsetaPersonUid: {
    type: String,
    trim: true
  },
  outsetaAccountUid: {
    type: String,
    trim: true
  },
  outsetaSubscriptionUid: {
    type: String,
    trim: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}, { timestamps: true });

// Auto-delete expired pending registrations
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Hash password before saving
// pendingRegistrationSchema.pre("save", async function (next) {
//   if (!this.isModified("password") || !this.password) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// Compare password
// pendingRegistrationSchema.methods.comparePassword = async function (plainPwd) {
//   if (!this.password) return false;
//   return await bcrypt.compare(plainPwd, this.password);
// };

export default mongoose.model("PendingRegistration", pendingRegistrationSchema);