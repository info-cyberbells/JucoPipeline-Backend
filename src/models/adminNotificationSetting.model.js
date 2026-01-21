import mongoose from "mongoose";

const adminNotificationSettingSchema = new mongoose.Schema(
  {
    adminRole: {
      type: String,
      enum: ["superAdmin"],
      required: true,
      unique: true
    },

    triggers: {
      playerRegistration: {
        type: Boolean,
        default: true
      },
      playerProfileClaim: {
        type: Boolean,
        default: true
      },
      coachRegistration: {
        type: Boolean,
        default: true
      },
      scoutRegistration: {
        type: Boolean,
        default: true
      },
      requestMoreVideo: {
        type: Boolean,
        default: true
      }
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "AdminNotificationSetting",
  adminNotificationSettingSchema
);
