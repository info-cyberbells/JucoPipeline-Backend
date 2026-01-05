import mongoose from "mongoose";

const coachNoteSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    noteText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000 // 5000 characters max
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    lastEditedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt automatically
  }
);

// Compound index: one coach can have multiple notes for same player
coachNoteSchema.index({ coach: 1, player: 1 });

// Index for efficient querying
coachNoteSchema.index({ coach: 1, isArchived: 1 });

// Virtual for formatted dates
coachNoteSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Instance method to check if note belongs to coach
coachNoteSchema.methods.belongsToCoach = function(coachId) {
  return this.coach.toString() === coachId.toString();
};

export default mongoose.model("CoachNote", coachNoteSchema);