import Joi from "joi";
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "Invalid team ID format"
});

// Create game validation
export const createGameSchema = Joi.object({
  homeTeamId: objectId.required(),
  awayTeamId: objectId.required(),
  date: Joi.date().iso().required(),
  time: Joi.string().trim().required(),
  location: Joi.string().trim().max(500).required(),
  streamLink: Joi.string().trim().uri().allow(null, '').optional(),
  status: Joi.string().valid("upcoming", "live", "completed", "cancelled").optional()
}).unknown(false);

// Update game validation
export const updateGameSchema = Joi.object({
  homeTeamId: objectId.optional(),
  awayTeamId: objectId.optional(),
  date: Joi.date().iso().optional(),
  time: Joi.string().trim().optional(),
  location: Joi.string().trim().max(500).optional(),
  streamLink: Joi.string().trim().uri().allow(null, '').optional(),
  status: Joi.string().valid("upcoming", "live", "completed", "cancelled").optional()
}).unknown(false);

// Update status validation
export const updateStatusSchema = Joi.object({
  status: Joi.string().valid("upcoming", "live", "completed", "cancelled").required()
}).unknown(false);

// Bulk delete validation
export const bulkDeleteSchema = Joi.object({
  gameIds: Joi.array().items(Joi.string()).min(1).required()
}).unknown(false);

// Validation middleware
export const validateCreateGame = (req, res, next) => {
  const { error } = createGameSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateUpdateGame = (req, res, next) => {
  const { error } = updateGameSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateUpdateStatus = (req, res, next) => {
  const { error } = updateStatusSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateBulkDelete = (req, res, next) => {
  const { error } = bulkDeleteSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};