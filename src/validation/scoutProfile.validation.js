import Joi from "joi";

// Change password validation
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Current password is required",
    "any.required": "Current password is required"
  }),
  newPassword: Joi.string().min(8).required().messages({
    "string.empty": "New password is required",
    "string.min": "New password must be at least 8 characters long",
    "any.required": "New password is required"
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    "string.empty": "Confirm password is required",
    "any.only": "New password and confirm password do not match",
    "any.required": "Confirm password is required"
  })
}).unknown(false);

// Validation middleware
export const validateChangePassword = (req, res, next) => {
  const { error } = changePasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

// Update Scout profile validation
export const updateScoutProfileSchema = Joi.object({
  firstName: Joi.string().trim().max(191).optional(),
  lastName: Joi.string().trim().max(191).allow(null, '').optional(),
  email: Joi.string().trim().email().optional(),
  password: Joi.string().min(8).optional().allow(''),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    "string.pattern.base": "Invalid phone number format"
  }),
  // Professional information
  state: Joi.string().trim().max(191).optional(),
  teamId: Joi.string().trim().max(191).allow(null, '').optional(),
  jobTitle: Joi.string().trim().max(191).optional()
}).unknown(false);

// Validation middleware
export const validateUpdateScoutProfile = (req, res, next) => {
  const { error } = updateScoutProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};