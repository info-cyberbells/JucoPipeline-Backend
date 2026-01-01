import Joi from "joi";

// Common vehicle validation schema
const vehicleSchema = Joi.object({
  make: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Make is required.",
    "any.required": "Make is required.",
  }),

  model: Joi.string().trim().min(1).max(50).required().messages({
    "string.empty": "Model is required.",
    "any.required": "Model is required.",
  }),

  year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).required().messages({
    "number.base": "Year must be a number.",
    "number.min": "Year must be 1990 or newer.",
    "number.max": "Year cannot be in the far future.",
  }),

  color: Joi.string().trim().max(30).optional(),

  vin: Joi.string()
    .alphanum()
    .length(17)
    .optional()
    .messages({
      "string.length": "VIN must be exactly 17 characters.",
    }),

  plateNo: Joi.string().trim().min(3).max(15).required().messages({
    "string.empty": "Plate number is required.",
  }),

  registrationState: Joi.string().trim().max(10).optional(),

  capacity: Joi.number().integer().min(1).max(10).required().messages({
    "number.base": "Capacity must be a number.",
    "number.min": "Capacity must be at least 1.",
    "number.max": "Capacity cannot exceed 10 passengers.",
  }),

  fuelType: Joi.string()
    .valid("petrol", "diesel", "electric", "hybrid")
    .optional()
    .messages({
      "any.only": "Fuel type must be one of petrol, diesel, electric, or hybrid.",
    }),

  transmission: Joi.string()
    .valid("manual", "automatic")
    .optional()
    .messages({
      "any.only": "Transmission must be manual or automatic.",
    }),

  registrationExpiry: Joi.date().optional(),
  lastInspection: Joi.date().optional(),

  insurance: Joi.object({
    provider: Joi.string().trim().optional(),
    policyNo: Joi.string().trim().optional(),
    expiryDate: Joi.date().optional(),
  }).optional(),

  active: Joi.boolean().optional(),
});

// Create Validation
export const validateCreateVehicle = (data) => vehicleSchema.validate(data, { abortEarly: false });

// Update Validation (all fields optional)
export const validateUpdateVehicle = (data) =>
  vehicleSchema.fork(Object.keys(vehicleSchema.describe().keys), (schema) =>
    schema.optional()
  ).validate(data, { abortEarly: false });
