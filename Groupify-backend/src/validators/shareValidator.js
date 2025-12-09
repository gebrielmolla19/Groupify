const Joi = require('joi');

/**
 * Share Validation Schemas
 * Joi validation schemas for share-related endpoints
 */

/**
 * Validation schema for sharing a song
 */
const shareSongSchema = Joi.object({
  groupId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.empty': 'Group ID is required',
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
    }),
  spotifyTrackId: Joi.string()
    .pattern(/^[a-zA-Z0-9]{22}$/)
    .required()
    .messages({
      'string.empty': 'Spotify track ID is required',
      'string.pattern.base': 'Invalid Spotify track ID format',
      'any.required': 'Spotify track ID is required'
    })
});

/**
 * Validation schema for group feed query parameters
 */
const groupFeedQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.min': 'Offset must be at least 0'
    })
});

/**
 * Validation schema for share ID parameter
 */
const shareIdSchema = Joi.object({
  shareId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid share ID format',
      'any.required': 'Share ID is required'
    })
});

/**
 * Validation schema for group ID parameter (for feed)
 */
const groupIdParamSchema = Joi.object({
  groupId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
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
  shareSongSchema,
  groupFeedQuerySchema,
  shareIdSchema,
  groupIdParamSchema,
  validate
};

