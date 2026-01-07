import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Batting Statistics Schema
const battingStatsSchema = new mongoose.Schema({
  seasonYear: String,
  games_played: Number,
  games_started: Number,
  at_bats: Number,
  runs: Number,
  hits: Number,
  doubles: Number,
  triples: Number,
  home_runs: Number,
  rbi: Number,
  total_bases: Number,
  walks: Number,
  hit_by_pitch: Number,
  strikeouts: Number,
  grounded_into_double_play: Number,
  stolen_bases: Number,
  caught_stealing: Number,
  batting_average: Number,
  on_base_percentage: Number,
  slugging_percentage: Number,
  sacrifice_flies: Number,
  sacrifice_hits: Number,

  // NEW FROM CSV
  hit_by_pitch_total: Number,     // HBP (duplicate safe if needed)
  intentional_walks: Number,      // if added later
  walk_percentage: Number,        // BB%
  strikeout_percentage: Number,   // SO%
  on_base_plus_slugging: Number,  // OPS

}, { _id: false });

// Fielding Statistics Schema
const fieldingStatsSchema = new mongoose.Schema({
  seasonYear: String,
  putouts: Number,
  assists: Number,
  errors: Number,
  fielding_percentage: Number,
  double_plays: Number,
  total_chances: Number,
  stolen_bases_against: Number,
  runners_caught_stealing: Number,
  runners_caught_stealing_percentage: Number,
  passed_balls: Number,
  catcher_interference: Number,

  // NEW FROM CSV (F_ prefixed)
  fielding_games: Number,                 // F_G
  fielding_games_started: Number,         // F_GS (if needed)
  fielding_total_chances: Number,         // F_TC
  fielding_putouts: Number,               // F_PO
  fielding_assists: Number,               // F_A
  fielding_errors: Number,                // F_E
  fielding_percentage_value: Number,      // F_FPCT
  fielding_double_plays: Number,          // F_DP

  stolen_base_attempts_against: Number,   // F_SBA
  runners_caught_stealing_total: Number,  // F_CSB
  stolen_base_success_rate: Number,       // F_SBA%
  caught_stealing_percentage: Number,     // F_RCS%

}, { _id: false });

// Pitching Statistics Schema
const pitchingStatsSchema = new mongoose.Schema({
  seasonYear: String,
  wins: Number,
  losses: Number,
  era: Number,
  games_pitched: Number,
  complete_games: Number,
  shutouts: Number,
  saves: Number,
  innings_pitched: Number,
  hits_allowed: Number,
  runs_allowed: Number,
  earned_runs: Number,
  walks_allowed: Number,
  strikeouts_pitched: Number,
  doubles_allowed: Number,
  triples_allowed: Number,
  home_runs_allowed: Number,
  at_bats_against: Number,
  batting_average_against: Number,
  wild_pitches: Number,
  hit_batters: Number,
  balks: Number,
  sacrifice_flies_allowed: Number,
  sacrifice_hits_allowed: Number,

  // NEW FROM CSV
  appearances: Number,              // P_APP
  games_started: Number,            // P_GS
  innings_pitched_decimal: Number,  // P_IP
  walks_per_nine: Number,           // BB/9
  strikeouts_per_nine: Number,      // K/9
  home_runs_per_nine: Number,       // HR/9
  batting_average_allowed: Number,  // P_B/AVG
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    firstName: { 
      type: String, 
      required: function () {
        return this.role !== "jucocoach" && this.role !== "media";
      },
      trim: true 
    },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      required: function () {
        return this.role !== "player";
      },
      validate: {
        validator: function (value) {
          if (!value) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: "Please enter a valid email address",
      },
    },
    password: {
      type: String,
      required: function () {
        return this.role !== "player" && this.role !== "jucocoach" && this.role !== "media";
      },
      minlength: 6
    },
    role: {
      type: String,
      enum: ["superAdmin", "scout", "coach", "player", 'jucocoach', 'media'],
      required: true,
    },
    phoneNumber: {
      type: String,
      default: null
    },
    profileImage: {
      type: String,
      default: null
    },

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: function () {
        return this.role === "player";
      }
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4
    },
    sat: {
      type: Number,
      min: 400,
      max: 1600
    },
    act: {
      type: Number,
      min: 1,
      max: 36
    },
    transferStatus: {
      type: String,
      enum: ['Freshman', 'Transfer', 'JUCO Transfer', '4-Year Transfer']
    },
    playerClass: {
      type: String,
      // enum: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
      default: null
    },
    playerScore: {
      type: Number,
      default: null
    },
    jpRank: {
      type: String,
      default: null
    },
    conferenceStrengthScore: {
      type: String,
      default: null
    },
    velo: {
      type: String,
      default: null
    },
    whip: {
      type: String,
      default: null
    },
    region: {
      type: String,
      default: null
    },
    acedemicInfo: {
      url: String,
      filename: String,
      uploadedAt: Date,
      fileSize: Number
    },
    // Additional Player Information (from CSV)
    jerseyNumber: {
      type: String,
      trim: true
    },
    position: {
      type: String,
      trim: true
    },
    height: {
      type: String,
      trim: true
    },
    weight: {
      type: String,
      trim: true
    },
    batsThrows: {
      type: String,
      trim: true
    },
    hometown: {
      type: String,
      trim: true
    },
    // Current || New School
    highSchool: {
      type: String,
      trim: true
    },
    previousSchool: {
      type: String,
      trim: true
    },

    // Player Statistics
    battingStats: [battingStatsSchema],
    fieldingStats: [fieldingStatsSchema],
    pitchingStats: [pitchingStatsSchema],

    // CSV Import tracking
    csvImported: {
      type: Boolean,
      default: false
    },
    lastCsvImport: {
      type: Date,
      default: null
    },

    // Scout-specific fields
    jobTitle: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "scout";
      }
    },

    // Coach-specific fields
    school: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "coach";
      }
    },
    schoolType: {
      type: String,
      trim: true,
      enum: ["High School", "Junior College", "College", "University", "Other"],
      // required: function () {
      //   return this.role === "coach";
      // }
    },
    division: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "coach";
      }
    },
    conference: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "coach";
      }
    },

    // Common field for scout and coach
    state: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "scout" || this.role === "coach";
      }
    },

    // Registration workflow for players
    registrationStatus: {
      type: String,
      enum: ["inProgress", "pending", "approved", "rejected"],
      default: function () {
        return this.role === "player" ? "pending" : "approved";
      }
    },

    photoIdDocument: {
      documentUrl: String,
      uploadedAt: { type: Date, default: Date.now },
      ipAddress: String,
      userAgent: String
    },

    // Photo ID verification
    // photoIdDocuments: [{
    //   documentUrl: String,
    //   uploadedAt: { type: Date, default: Date.now },
    //   ipAddress: String,
    //   userAgent: String
    // }],

    lastPhotoIdUpload: {
      type: Date,
      default: null
    },

    // Admin approval tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true
    },

    // Login history
    lastLogin: {
      type: Date,
      default: null
    },

    city: { type: String, trim: true },
    country: { type: String, trim: true },
    title: {
      type: String,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    primaryPosition: {
      type: String,
      trim: true
    },
    strengths: [{
      type: String,
      trim: true
    }],
    videos: [{
      url: String,
      title: String,
      uploadedAt: { type: Date, default: Date.now },
      fileSize: Number,
      duration: Number
    }],
    coachRecommendation: {
      url: String,
      filename: String,
      uploadedAt: Date,
      fileSize: Number
    },
    awardsAchievements: [{
      type: String,
      trim: true
    }],
    profileCompleteness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    instaURL: {
      type: String,
      trim: true
    },
    xURL: {
      type: String,
      trim: true
    },
    organization: {
      type: String,
      trim: true
    },
    certificate: {
      type: String,
      trim: true
    },
    commitmentStatus: {
      type: String,
      enum: ["uncommitted", "committed"],
      default: "uncommitted"
    },
    committedTo: {
      type: String,
      trim: true
    },
    commitmentUpdatedByAdmin: {
      type: Boolean,
      default: false
    },
    lastManualEdit: {
      type: Date,
      default: null
    },
    manualEditBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    // Subscription fields
    stripeCustomerId: {
      type: String,
      sparse: true
    },
    subscriptionStatus: {
      type: String,
      enum: ["none", "active", "canceled", "past_due", "trialing"],
      default: "none"
    },
    // subscriptionPlan: {
    //   type: String,
    //   enum: ["none", "coach_monthly", "coach_yearly", "scout_monthly", "scout_yearly"],
    //   default: "none"
    // },
    subscriptionPlan: {
      type: String,
      default: "none"
    },
    subscriptionEndDate: {
      type: Date
    },
    paypalSubscriptionId: {
      type: String,
      trim: true,
      // index: true
    },

    paymentProvider: {
      type: String,
      enum: ['stripe', 'paypal', 'outseta', null],
      default: null
    },
    outsetaPersonUid: {
      type: String,
      trim: true,
      sparse: true
    },
    outsetaAccountUid: {
      type: String,
      trim: true,
      sparse: true
    },
    outsetaMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

userSchema.index({ paypalSubscriptionId: 1 }, { sparse: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (plainPwd) {
  if (!this.password) return false;
  return await bcrypt.compare(plainPwd, this.password);
};

// Get full name
userSchema.methods.getFullName = function () {
  return `${this.firstName}${this.lastName ? ' ' + this.lastName : ''}`;
};

export default mongoose.model("User", userSchema);