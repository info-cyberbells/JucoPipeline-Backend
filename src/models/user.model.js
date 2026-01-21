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
  intentional_walks: Number,
  walk_percentage: Number,
  strikeout_percentage: Number,
  on_base_plus_slugging: Number,
  attempts: Number,
  ground_into_double_play: Number,
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
  passed_balls: Number,
  catcher_interference: Number,
  fielding_games: Number,
  fielding_games_started: Number,
  stolen_base_success_rate: Number,
  runners_caught_stealing_percentage: Number,
  stolen_bases_allowed: Number,
  stolen_base_attempt_percentage: Number,
  caught_stealing_by_catcher: Number,
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
  appearances: Number,
  games_started: Number,
  batting_average_allowed: Number,
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
    tempPassword: {
      type: String,
      default: null
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
    ncaaId: {
      type: Number,
      default: null
    },
    academic_info_gpa: {
      type: Number,
      min: 0,
      max: 4
    },
    academic_info_sat: {
      type: Number,
      min: 400,
      max: 1600
    },
    academic_info_act: {
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
    player_bio: {
      type: String,
      default: null
    },
    awards_honors: {
      type: String,
      default: null
    },
    collegeIcon: {
      type: String,
      default: null
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
    battingStats: [battingStatsSchema],
    fieldingStats: [fieldingStatsSchema],
    pitchingStats: [pitchingStatsSchema],
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
    lastLogin: { type: Date, default: null },
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