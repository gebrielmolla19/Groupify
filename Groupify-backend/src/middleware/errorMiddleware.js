/**
 * Centralized Error Handling Middleware
 * Handles all errors passed via next(error) from controllers
 */

/**
 * Main error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log error with context for debugging
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.userId || 'unauthenticated',
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Prepare error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error'
  };

  // Include additional error details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    
    // Include Spotify-specific error details if available
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

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};

