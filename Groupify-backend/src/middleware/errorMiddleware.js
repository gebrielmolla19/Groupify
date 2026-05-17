/**
 * Centralized Error Handling Middleware
 * Handles all errors passed via next(error) from controllers
 */
const logger = require('../utils/logger');

/**
 * Main error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const DUPLICATE_SONG_MESSAGE = 'This song is already in the group feed';

/**
 * Map MongoDB duplicate key errors to user-friendly messages.
 * @param {Error} err
 * @returns {{ statusCode: number, message: string } | null}
 */
const mapMongoDuplicateError = (err) => {
  if (err.code !== 11000) {
    return null;
  }

  const keyPattern = err.keyPattern || err.keyValue;
  const isGroupTrackDuplicate =
    err.message?.includes('group_1_spotifyTrackId') ||
    (keyPattern && 'group' in keyPattern && 'spotifyTrackId' in keyPattern);

  if (isGroupTrackDuplicate) {
    return { statusCode: 409, message: DUPLICATE_SONG_MESSAGE };
  }

  return { statusCode: 409, message: 'This item already exists' };
};

const errorHandler = (err, req, res, next) => {
  const duplicateMapping = mapMongoDuplicateError(err);
  if (duplicateMapping && !err.statusCode) {
    err.statusCode = duplicateMapping.statusCode;
    err.message = duplicateMapping.message;
  }

  const statusCode = err.statusCode || err.status || 500;

  // Use error level for 5xx, warn for 4xx (expected client errors)
  const logLevel = statusCode >= 500 ? 'error' : 'warn';

  logger[logLevel]('[Error] Request failed', {
    message: err.message,
    statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.userId || 'unauthenticated',
    ip: req.ip,
    ...(err.spotifyError && { spotifyError: err.spotifyError }),
    ...(err.spotifyErrorDetails && { spotifyErrorDetails: err.spotifyErrorDetails }),
    ...(err.details && { details: err.details })
  });

  // Prepare error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error'
  };

  // Include additional error details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;

    if (err.spotifyError) {
      errorResponse.spotifyError = err.spotifyError;
    }

    if (err.spotifyErrorDetails) {
      errorResponse.spotifyErrorDetails = err.spotifyErrorDetails;
    }

    if (err.details) {
      errorResponse.details = err.details;
    }
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  logger.warn('[Error] Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
