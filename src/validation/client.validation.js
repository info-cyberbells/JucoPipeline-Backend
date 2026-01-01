import Joi from "joi";

export const createClientSchema = Joi.object({
  fullName: Joi.string().trim().max(191).required(),
  password: Joi.string().min(6).required(),
  companyName: Joi.string().trim().max(191).required(),
  correspondedMe: Joi.string().trim().max(191).required(),
  email: Joi.string().trim().email().required(),
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid phone number format" }),
}).unknown(false);

export const updateClientSchema = Joi.object({
  fullName: Joi.string().trim().max(191).optional(),
  companyName: Joi.string().trim().max(191).optional(),
  correspondedMe: Joi.string().trim().max(191).optional(),
  email: Joi.string().trim().email().optional(),
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .messages({ "string.pattern.base": "Invalid phone number format" }),
}).unknown(false);

export const validateCreateClient = (req, res, next) => {
  const { error } = createClientSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};

export const validateUpdateClient = (req, res, next) => {
  const { error } = updateClientSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join(", "),
    });
  }
  next();
};