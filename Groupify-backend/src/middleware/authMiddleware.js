const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[Auth] Missing or malformed Authorization header', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: 'No token provided or invalid format. Use: Bearer <token>'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-spotifyAccessToken -spotifyRefreshToken');

    if (!user) {
      logger.warn('[Auth] Token valid but user not found in database', {
        userId: decoded.userId,
        url: req.originalUrl,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    if (!user.isActive) {
      logger.warn('[Auth] Token valid but user account is inactive', {
        userId: decoded.userId,
        url: req.originalUrl,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = decoded.userId;

    logger.debug('[Auth] User authenticated successfully', {
      userId: decoded.userId,
      url: req.originalUrl,
      method: req.method
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('[Auth] Invalid JWT token', {
        url: req.originalUrl,
        ip: req.ip,
        reason: error.message
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('[Auth] Expired JWT token', {
        url: req.originalUrl,
        ip: req.ip,
        expiredAt: error.expiredAt
      });

      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('[Auth] Unexpected authentication error', {
      url: req.originalUrl,
      ip: req.ip,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Generate JWT token for a user
 * @param {string} userId - User MongoDB ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' } // Token expires in 1 day
  );
};

module.exports = {
  authMiddleware,
  generateToken
};
