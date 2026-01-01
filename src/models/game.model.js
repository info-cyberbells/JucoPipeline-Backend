import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    homeTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    awayTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    streamLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true;
          // Basic URL validation
          return /^https?:\/\/.+/.test(value);
        },
        message: "Please enter a valid stream URL"
      }
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "completed", "cancelled"],
      default: "upcoming"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Index for faster queries
gameSchema.index({ date: -1 });
gameSchema.index({ status: 1 });
gameSchema.index({ homeTeam: 1 });
gameSchema.index({ awayTeam: 1 });

export default mongoose.model("Game", gameSchema);