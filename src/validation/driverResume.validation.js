import Joi from "joi";

export const driverResumeSchema = Joi.object({
  basicInfo: Joi.object({
    fullName: Joi.string().trim().required().messages({
      "string.empty": "Full name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Invalid email format",
      "string.empty": "Email is required",
    }),
    municipality: Joi.string().allow(""),
    dob: Joi.date().optional(),
    licenseNumber: Joi.string().allow(""),
    licenseExpiryDate: Joi.date().optional(),
    licensePhoto: Joi.string().uri().allow(""),
  }).required(),

  experience: Joi.array()
    .items(
      Joi.object({
        companyName: Joi.string().required().messages({
          "string.empty": "Company name is required in experience",
        }),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        routeType: Joi.string()
          .valid("City", "Local Delivery", "Highway", "Interstate")
          .required(),
        vehicleType: Joi.string()
          .valid("2-Wheeler", "4-Wheeler", "LCV", "HMV", "Truck", "Bus")
          .required(),
        description: Joi.string().allow(""),
      })
    )
    .optional(),

  skillPreferences: Joi.object({
    skills: Joi.array()
      .items(
        Joi.string().valid("City", "Highway", "Local Delivery", "Long Route")
      )
      .optional(),
    additionalPreferences: Joi.string().allow(""),
  }).optional(),
});

// Create Validation
export const validateCreateResume = (data) => driverResumeSchema.validate(data, { abortEarly: false });

// Update Validation (make all optional)
export const validateUpdateResume = (data) =>
  driverResumeSchema.fork(Object.keys(driverResumeSchema.describe().keys), (schema) => schema.optional()).validate(data, {
    abortEarly: false,
  });