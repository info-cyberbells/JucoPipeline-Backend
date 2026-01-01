import mongoose from "mongoose";

const savedFilterSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        queryParams: {
            type: Object,
            required: true
        },

        hittingStats: {
            type: [String],
            default: []
        },

        pitchingStats: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
);

export default mongoose.model("SavedFilter", savedFilterSchema);
