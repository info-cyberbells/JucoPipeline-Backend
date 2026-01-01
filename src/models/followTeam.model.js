import mongoose from "mongoose";

const followTeamSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    followedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate follows and improve query performance
followTeamSchema.index({ coach: 1, team: 1 }, { unique: true });
followTeamSchema.index({ coach: 1 });
followTeamSchema.index({ team: 1 });

export default mongoose.model("FollowTeam", followTeamSchema);