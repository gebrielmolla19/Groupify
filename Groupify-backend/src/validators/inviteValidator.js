const Joi = require('joi');

/**
 * Invite Validation Schemas
 * Joi validation schemas for invite-related endpoints
 */

/**
 * Validation schema for inviting a user
 */
const inviteUserSchema = Joi.object({
  invitedUserSpotifyId: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Spotify User ID is required',
      'any.required': 'Spotify User ID is required'
    })
});

/**
 * Validation schema for group ID parameter
 */
const groupIdSchema = Joi.object({
  groupId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
    })
});

/**
 * Validation schema for invite ID parameter
 */
const inviteIdSchema = Joi.object({
  inviteId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid invite ID format',
      'any.required': 'Invite ID is required'
    })
});

/**
 * Validation schema for both group ID and invite ID parameters
 */
const groupIdAndInviteIdSchema = Joi.object({
  groupId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
    }),
  inviteId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid invite ID format',
      'any.required': 'Invite ID is required'
    })
});

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Where to validate (body, params, query)
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Merge validated data with existing params to preserve other route parameters
    if (source === 'params') {
      req[source] = { ...req[source], ...value };
    } else {
      req[source] = value;
    }
    next();
  };
};

module.exports = {
  inviteUserSchema,
  groupIdSchema,
  inviteIdSchema,
  groupIdAndInviteIdSchema,
  validate
};

