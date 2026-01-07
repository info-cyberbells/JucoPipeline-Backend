import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    logo: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    division: {
      type: String,
      trim: true
    },
    region: {
      type: String,
      trim: true
    },
    rank: {
      type: Number
    },
    coachName: {
      type: String,
      trim: true
    },
    overallRecord: {
      type: String,
      trim: true
    },
    home: {
      type: String,
      trim: true
    },
    away: {
      type: String,
      trim: true
    },
    neutral: {
      type: String,
      trim: true
    },
    conference: {
      type: String,
      trim: true
    },
    topPerformer: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      stats: {
        type: String,
        trim: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Indexes for faster queries
teamSchema.index({ name: 1 });
teamSchema.index({ division: 1 });
teamSchema.index({ region: 1 });

export default mongoose.model("Team", teamSchema);