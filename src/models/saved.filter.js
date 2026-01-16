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
            required: false
        },

        hittingStats: {
            type: [
                {
                    stat: {
                        type: String,
                        required: true
                    },
                    minValue: {
                        type: Number,
                        required: true
                    },
                    maxValue: {
                        type: Number,
                        required: true
                    }
                }
            ],
            default: []
        },


        pitchingStats: {
            type: [
                {
                    stat: {
                        type: String,
                        required: true
                    },
                    minValue: {
                        type: Number,
                        required: true
                    },
                    maxValue: {
                        type: Number,
                        required: true
                    }
                }
            ],
            default: []
        }

    },
    { timestamps: true }
);

export default mongoose.model("SavedFilter", savedFilterSchema);
