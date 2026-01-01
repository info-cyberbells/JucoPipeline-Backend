import Joi from "joi";

// Update user validation
export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim().max(191).optional(),
  lastName: Joi.string().trim().max(191).allow(null, '').optional(),
  email: Joi.string().trim().email().optional(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    "string.pattern.base": "Invalid phone number format"
  }),
  organization: Joi.string().trim().max(191).allow(null, '').optional(),
  role: Joi.string().valid("scout", "coach", "player").optional(),
  certificate: Joi.string().trim().max(500).allow(null, '').optional(),
  registrationStatus: Joi.string().valid("pending", "approved", "rejected").optional(),
  commitmentStatus: Joi.string().valid("uncommitted", "committed").optional(),
  committedTo: Joi.string().trim().max(191).allow(null, '').optional()
}).unknown(false);

// Update status validation
export const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
}).unknown(false);

// Validation middleware
export const validateUpdateUser = (req, res, next) => {
  const { error } = updateUserSchema.validate(req.body, { abortEarly: false });
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