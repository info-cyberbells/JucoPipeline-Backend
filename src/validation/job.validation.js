import Joi from "joi";

// Shared Schema
const jobSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).optional(),

  vehicleId: Joi.string().optional(),

  location: Joi.object({
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    country: Joi.string().trim().optional(),
  }).optional(),

  vacancy: Joi.number().integer().min(1).max(50).required(),

  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),

  salary: Joi.number().min(0).required(),

  requirements: Joi.array().items(Joi.string().trim()).optional(),
});

// Create Validation
export const validateCreateJob = (data) => jobSchema.validate(data, { abortEarly: false });

// Update Validation (make all optional)
export const validateUpdateJob = (data) =>
  jobSchema.fork(Object.keys(jobSchema.describe().keys), (schema) => schema.optional()).validate(data, {
    abortEarly: false,
  });
