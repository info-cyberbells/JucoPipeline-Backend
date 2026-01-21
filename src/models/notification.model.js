import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // Who should receive this notification
    recipientRole: {
      type: String,
      enum: ["superAdmin"],
      required: true,
      index: true
    },

    // Short heading for UI
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    // Detailed message
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },

    // High-level notification category
    type: {
      type: String,
      enum: [
        "PLAYER_REGISTRATION",
        "PLAYER_LOGIN_CLAIM",
        "USER_REGISTRATION",
        "VIDEO_REQUEST"
      ],
      required: true,
      index: true
    },

    // Extra contextual data (scalable design)
    meta: {
      role: {
        type: String,
        enum: ["scout", "coach"],
        default: null
      },
      extra: {
        type: mongoose.Schema.Types.Mixed, // better than Object
        default: {}
      }
    },

    // Related entity (player, user, video request, etc.)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },

    // Who triggered the notification
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    // Read status (admin side)
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

/* ================= INDEXES ================= */

// Fast admin notification feed
notificationSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });

// Filtering by type + role (e.g. coach registrations)
notificationSchema.index({ type: 1, "meta.role": 1 });

/* ================= VIRTUALS ================= */

// For Admin UI display
notificationSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
});

/* ================= INSTANCE METHODS ================= */

// Mark notification as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

export default mongoose.model("Notification", notificationSchema);
