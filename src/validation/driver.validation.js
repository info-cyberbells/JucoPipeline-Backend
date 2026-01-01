import Joi from "joi";

export const createDriverSchema = Joi.object({
  fullName: Joi.string().trim().max(191).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).required(),
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid phone number format" }),
  licenseNumber: Joi.string()
    .pattern(/^[A-Z0-9-]{5,20}$/i)
    .required()
    .messages({
      "string.pattern.base": "License number must be 5–20 characters (letters, numbers, or hyphens)",
    }),
  municipality: Joi.string().trim().max(191).required(),
  vehicleRegistration: Joi.string().trim().max(191).optional().allow(""),
  validUntil: Joi.date()
    .greater("now")
    .required()
    .messages({ "date.greater": "Valid Until must be a future date" }),
}).unknown(false);

export const updateDriverSchema = Joi.object({
  fullName: Joi.string().trim().max(191).optional(),
  email: Joi.string().trim().email().optional(),
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .messages({ "string.pattern.base": "Invalid phone number format" }),
  licenseNumber: Joi.string()
    .pattern(/^[A-Z0-9-]{5,20}$/i)
    .optional()
    .messages({
      "string.pattern.base": "License number must be 5–20 characters (letters, numbers, or hyphens)",
    }),
  municipality: Joi.string().trim().max(191).optional(),
  vehicleRegistration: Joi.string().trim().max(191).optional().allow(""),
  validUntil: Joi.date()
    .greater("now")
    .optional()
    .messages({ "date.greater": "Valid Until must be a future date" }),
}).unknown(false);

export const validateCreateDriver = (req, res, next) => {
  const { error } = createDriverSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateUpdateDriver = (req, res, next) => {
  const { error } = updateDriverSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};