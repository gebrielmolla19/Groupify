const Joi = require('joi');

/**
 * Group Validation Schemas
 * Joi validation schemas for group-related endpoints
 */

/**
 * Validation schema for creating a group
 */
const createGroupSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Group name is required',
      'string.min': 'Group name must be at least 3 characters',
      'string.max': 'Group name cannot exceed 100 characters',
      'any.required': 'Group name is required'
    }),
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
});

/**
 * Validation schema for joining a group
 */
const joinGroupSchema = Joi.object({
  inviteCode: Joi.string()
    .length(16)
    .required()
    .messages({
      'string.empty': 'Invite code is required',
      'string.length': 'Invite code must be exactly 16 characters',
      'any.required': 'Invite code is required'
    })
});

/**
 * Validation schema for group ID parameter
 */
const groupIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
    })
});

/**
 * Validation schema for group ID parameter in settings routes (uses groupId)
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
 * Validation schema for updating group settings
 */
const updateGroupSettingsSchema = Joi.object({
  name: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Group name cannot exceed 100 characters'
    }),
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field (name or description) must be provided'
});

/**
 * Validation schema for member ID parameter
 */
const memberIdSchema = Joi.object({
  memberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid member ID format',
      'any.required': 'Member ID is required'
    })
});

/**
 * Validation schema for group ID and member ID parameters (for remove member route)
 */
const groupIdAndMemberIdSchema = Joi.object({
  groupId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid group ID format',
      'any.required': 'Group ID is required'
    }),
  memberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid member ID format',
      'any.required': 'Member ID is required'
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

    // Replace the request data with validated/sanitized data
    req[source] = value;
    next();
  };
};

module.exports = {
  createGroupSchema,
  joinGroupSchema,
  groupIdSchema,
  groupIdParamSchema,
  updateGroupSettingsSchema,
  memberIdSchema,
  groupIdAndMemberIdSchema,
  validate
};

