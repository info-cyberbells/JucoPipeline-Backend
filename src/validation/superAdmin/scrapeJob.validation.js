import Joi from "joi";

// Custom ObjectId validator
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "Invalid ID format"
});

export const updateScrapeJobSchema = Joi.object({
  // Personal Information
  firstName: Joi.string().trim().max(191).optional(),
  lastName: Joi.string().trim().max(191).allow(null, '').optional(),
  email: Joi.string().trim().email().allow(null, '').optional(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').optional(),
  profileImage: Joi.string().uri().allow(null, '').optional(),

  // Team
  team: objectId.allow(null).optional(),

  // Player Details
  jerseyNumber: Joi.string().trim().max(10).allow(null, '').optional(),
  position: Joi.string().trim().max(50).allow(null, '').optional(),
  height: Joi.string().trim().max(20).allow(null, '').optional(),
  weight: Joi.string().trim().max(20).allow(null, '').optional(),
  batsThrows: Joi.string().trim().max(10).allow(null, '').optional(),
  hometown: Joi.string().trim().max(191).allow(null, '').optional(),
  highSchool: Joi.string().trim().max(191).allow(null, '').optional(),
  previousSchool: Joi.string().trim().max(191).allow(null, '').optional(),

  // Academic Information
  academic_info_gpa: Joi.number().min(0).max(4).allow(null).optional(),
  academic_info_sat: Joi.number().min(400).max(1600).allow(null).optional(),
  academic_info_act: Joi.number().min(1).max(36).allow(null).optional(),
  transferStatus: Joi.string().valid('Freshman', 'Transfer', 'JUCO Transfer', '4-Year Transfer').allow(null).optional(),
  playerClass: Joi.string().valid('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate').allow(null).optional(),

  // Status
  registrationStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  isActive: Joi.boolean().optional(),
  commitmentStatus: Joi.string().valid('uncommitted', 'committed').optional(),
  committedTo: Joi.string().trim().max(191).allow(null, '').optional(),

  // Statistics
  battingStats: Joi.array().items(
    Joi.object({
      seasonYear: Joi.string().required(),
      games_played: Joi.number().min(0).default(0),
      games_started: Joi.number().min(0).default(0),
      at_bats: Joi.number().min(0).default(0),
      runs: Joi.number().min(0).default(0),
      hits: Joi.number().min(0).default(0),
      doubles: Joi.number().min(0).default(0),
      triples: Joi.number().min(0).default(0),
      home_runs: Joi.number().min(0).default(0),
      rbi: Joi.number().min(0).default(0),
      total_bases: Joi.number().min(0).default(0),
      walks: Joi.number().min(0).default(0),
      hit_by_pitch: Joi.number().min(0).default(0),
      strikeouts: Joi.number().min(0).default(0),
      grounded_into_double_play: Joi.number().min(0).default(0),
      stolen_bases: Joi.number().min(0).default(0),
      caught_stealing: Joi.number().min(0).default(0),
      batting_average: Joi.number().min(0).max(1).default(0),
      on_base_percentage: Joi.number().min(0).max(1).default(0),
      slugging_percentage: Joi.number().min(0).default(0),
      sacrifice_flies: Joi.number().min(0).default(0),
      sacrifice_hits: Joi.number().min(0).default(0)
    })
  ).optional(),

  fieldingStats: Joi.array().items(
    Joi.object({
      seasonYear: Joi.string().required(),
      putouts: Joi.number().min(0).default(0),
      assists: Joi.number().min(0).default(0),
      errors: Joi.number().min(0).default(0),
      fielding_percentage: Joi.number().min(0).max(1).default(0),
      double_plays: Joi.number().min(0).default(0),
      total_chances: Joi.number().min(0).default(0),
      stolen_bases_against: Joi.number().min(0).default(0),
      runners_caught_stealing: Joi.number().min(0).default(0),
      runners_caught_stealing_percentage: Joi.number().min(0).max(1).default(0),
      passed_balls: Joi.number().min(0).default(0),
      catcher_interference: Joi.number().min(0).default(0)
    })
  ).optional(),

  pitchingStats: Joi.array().items(
    Joi.object({
      seasonYear: Joi.string().required(),
      wins: Joi.number().min(0).default(0),
      losses: Joi.number().min(0).default(0),
      era: Joi.number().min(0).default(0),
      games_pitched: Joi.number().min(0).default(0),
      complete_games: Joi.number().min(0).default(0),
      shutouts: Joi.number().min(0).default(0),
      saves: Joi.number().min(0).default(0),
      innings_pitched: Joi.number().min(0).default(0),
      hits_allowed: Joi.number().min(0).default(0),
      runs_allowed: Joi.number().min(0).default(0),
      earned_runs: Joi.number().min(0).default(0),
      walks_allowed: Joi.number().min(0).default(0),
      strikeouts_pitched: Joi.number().min(0).default(0),
      doubles_allowed: Joi.number().min(0).default(0),
      triples_allowed: Joi.number().min(0).default(0),
      home_runs_allowed: Joi.number().min(0).default(0),
      at_bats_against: Joi.number().min(0).default(0),
      batting_average_against: Joi.number().min(0).max(1).default(0),
      wild_pitches: Joi.number().min(0).default(0),
      hit_batters: Joi.number().min(0).default(0),
      balks: Joi.number().min(0).default(0),
      sacrifice_flies_allowed: Joi.number().min(0).default(0),
      sacrifice_hits_allowed: Joi.number().min(0).default(0)
    })
  ).optional(),

  // Additional Fields
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
  primaryPosition: Joi.string().trim().max(50).allow(null, '').optional(),
  strengths: Joi.array().items(Joi.string().trim()).optional(),
  awardsAchievements: Joi.array().items(Joi.string().trim()).optional(),
  instaURL: Joi.string().uri().allow(null, '').optional(),
  xURL: Joi.string().uri().allow(null, '').optional()
}).unknown(false);

// Validation middleware
export const validateUpdateScrapeJob = (req, res, next) => {
  const { error } = updateScrapeJobSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};