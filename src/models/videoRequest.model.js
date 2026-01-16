import mongoose from "mongoose";

const videoRequestSchema = new mongoose.Schema(
    {
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Coach
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "completed"],
            default: "pending"
        },
        note: {
            type: String
        },
        handledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        handledAt: Date
    },
    { timestamps: true }
);

export default mongoose.model("VideoRequest", videoRequestSchema);
