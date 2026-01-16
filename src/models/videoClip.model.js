import mongoose from "mongoose";

const videoClipSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    videoId: {
      type: String, // Changed from ObjectId to String (video's _id from user.videos array)
      required: true,
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    inTime: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(value) {
          return value >= 0;
        },
        message: "inTime must be greater than or equal to 0"
      }
    },
    outTime: {
      type: Number,
      required: true,
      validate: {
        validator: function(value) {
          return value > this.inTime;
        },
        message: "outTime must be greater than inTime"
      }
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(value) {
          return value >= 0;
        },
        message: "duration must be greater than or equal to 0"
      }
    },
    clipUrl: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing"
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
videoClipSchema.index({ coachId: 1, videoId: 1 });
videoClipSchema.index({ coachId: 1, playerId: 1 });
videoClipSchema.index({ coachId: 1, status: 1 });

// Pre-save hook to calculate duration if not provided
videoClipSchema.pre("save", function(next) {
  if (this.inTime !== undefined && this.outTime !== undefined && !this.duration) {
    this.duration = this.outTime - this.inTime;
  }
  next();
});

// Instance method to check ownership
videoClipSchema.methods.belongsToCoach = function(coachId) {
  return this.coachId.toString() === coachId.toString();
};

export default mongoose.model("VideoClip", videoClipSchema);