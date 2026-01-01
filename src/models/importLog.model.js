import mongoose from 'mongoose';

const fileResultSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['.csv', '.xlsx', '.xls'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    required: true
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  playersCreated: {
    type: Number,
    default: 0
  },
  playersUpdated: {
    type: Number,
    default: 0
  },
  teamsCreated: {
    type: Number,
    default: 0
  },
  recordsSkipped: {
    type: Number,
    default: 0
  },
  errors: [{
    playerName: String,
    collegeName: String,
    seasonYear: String,
    reason: String,
    error: String
  }]
}, { _id: false });

const importLogSchema = new mongoose.Schema({
  importType: {
    type: String,
    enum: ['directory', 'upload'],
    required: true
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null if imported by system/cron
  },
  summary: {
    filesProcessed: {
      type: Number,
      required: true
    },
    totalRecords: {
      type: Number,
      default: 0
    },
    playersCreated: {
      type: Number,
      default: 0
    },
    playersUpdated: {
      type: Number,
      default: 0
    },
    teamsCreated: {
      type: Number,
      default: 0
    },
    recordsSkipped: {
      type: Number,
      default: 0
    },
    totalErrors: {
      type: Number,
      default: 0
    }
  },
  fileResults: [fileResultSchema],
  status: {
    type: String,
    enum: ['completed', 'failed', 'partial'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // in milliseconds
    default: 0
  },
  importedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
importLogSchema.index({ importedAt: -1 });
importLogSchema.index({ importedBy: 1 });
importLogSchema.index({ status: 1 });

// Virtual for human-readable duration
importLogSchema.virtual('durationFormatted').get(function() {
  const seconds = Math.floor(this.duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
});

const ImportLog = mongoose.model('ImportLog', importLogSchema);

export default ImportLog;