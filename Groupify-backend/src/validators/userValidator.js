const Joi = require('joi');

/**
 * User Validation Schemas
 * Joi validation schemas for user-related endpoints
 */

/**
 * Validation schema for updating user profile
 */
const updateProfileSchema = Joi.object({
  displayName: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .messages({
      'string.empty': 'Display name is required',
      'string.min': 'Display name must be at least 3 characters',
      'string.max': 'Display name cannot exceed 50 characters',
    }),
  notificationPreferences: Joi.object({
    song_shared: Joi.boolean(),
    group_invite: Joi.boolean(),
    member_joined: Joi.boolean(),
  }),
}).or('displayName', 'notificationPreferences');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Where to validate (body, params, query)
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req[source] = value;
    next();
  };
};

module.exports = {
  updateProfileSchema,
  validate
};

