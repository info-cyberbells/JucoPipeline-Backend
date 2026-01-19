import Joi from "joi";

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "Invalid team ID format"
});

// Player registration (Step 1 - Addition Request Form)
export const playerRegisterSchema = Joi.object({
  firstName: Joi.string().trim().max(191).required(),
  lastName: Joi.string().trim().max(191).allow(null, '').optional(),
  email: Joi.string().trim().email().optional(), // Optional for players
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({ 
    "string.pattern.base": "Invalid phone number format" 
  }),
  teamId: objectId.optional(),
  ncaaId: Joi.string().trim().allow(null, '').optional(),
  xURL: Joi.string().trim().allow(null, '').optional(),
  instaURL: Joi.string().trim().allow(null, '').optional(),
}).unknown(false);

// Player login (Passwordless)
export const playerLoginSchema = Joi.object({
  teamId: objectId.optional(),
  playerName: Joi.string().trim().required(),
  email: Joi.string().trim().email().required()
}).unknown(false);

// Regular registration (scout, coach) - WITH CONDITIONAL FIELDS
export const registerSchema = Joi.object({
  firstName: Joi.string().trim().max(191).required(),
  lastName: Joi.string().trim().max(191).allow(null, '').optional(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("scout", "coach").required(),
  
  // Scout-specific fields
  // teamId: objectId.when('role', {
  //   is: 'scout',
  //   then: Joi.required().messages({
  //     "any.required": "Team ID is required for scouts"
  //   }),
  //   otherwise: Joi.optional()
  // }),
  teamId: objectId.optional(),
  jobTitle: Joi.string().trim().max(191).when('role', {
    is: 'scout',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  
  // Coach-specific fields
  school: Joi.string().trim().max(191).when('role', {
    is: 'coach',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  division: Joi.string().trim().max(191).when('role', {
    is: 'coach',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  conference: Joi.string().trim().max(191).when('role', {
    is: 'coach',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  
  // Common field for both scout and coach
  state: Joi.string().trim().max(191).required(),
}).unknown(false);

// Regular login
export const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required()
}).unknown(false);

// Admin reject player
export const rejectPlayerSchema = Joi.object({
  reason: Joi.string().trim().max(500).optional()
}).unknown(false);

// Validation middleware
export const validatePlayerRegister = (req, res, next) => {
  const { error } = playerRegisterSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validatePlayerLogin = (req, res, next) => {
  const { error } = playerLoginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateRegister = (req, res, next) => {
  const { error } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateRejectPlayer = (req, res, next) => {
  const { error } = rejectPlayerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};