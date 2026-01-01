import Joi from "joi";

// Forgot password validation
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
    "any.required": "Email is required"
  })
}).unknown(false);

export const validateForgotPassword = (req, res, next) => {
  const { error } = forgotPasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

// Verify OTP validation
export const verifyOtpSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
    "any.required": "Email is required"
  }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    "string.empty": "OTP is required",
    "string.length": "OTP must be 6 digits",
    "string.pattern.base": "OTP must contain only numbers",
    "any.required": "OTP is required"
  })
}).unknown(false);

export const validateVerifyOtp = (req, res, next) => {
  const { error } = verifyOtpSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

// Reset password validation
export const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().required().messages({
    "string.empty": "Reset token is required",
    "any.required": "Reset token is required"
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

export const validateResetPassword = (req, res, next) => {
  const { error } = resetPasswordSchema.validate(req.body, { abortEarly: false });
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