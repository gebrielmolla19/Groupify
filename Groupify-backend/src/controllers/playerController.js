const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const TokenManager = require('../utils/tokenManager');

/**
 * Player Controller
 * Handles Spotify playback control operations
 */
class PlayerController {
  /**
   * Get the user's available Spotify Connect devices
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static async getAvailableDevices(req, res, next) {
    try {
      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID not found in request');
        error.statusCode = 401;
        throw error;
      }

      // Get valid Spotify access token (handles refresh if needed)
      const accessToken = await TokenManager.getValidAccessToken(userId);

      const devices = await SpotifyService.getAvailableDevices(accessToken);

      res.json({
        success: true,
        devices
      });
    } catch (error) {
      // If error already has statusCode, pass it through
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      // Log error for debugging
      console.error('Get available devices error:', {
        error: error.message,
        userId: req.userId,
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  }

  /**
   * Transfer playback to a specific device
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static async transferPlayback(req, res, next) {
    try {
      const { device_id } = req.body;

      // Validate device_id is provided
      if (!device_id || typeof device_id !== 'string' || device_id.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required'
        });
      }

      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID not found in request');
        error.statusCode = 401;
        throw error;
      }

      // Get valid Spotify access token (handles refresh if needed)
      const accessToken = await TokenManager.getValidAccessToken(userId);

      // Transfer playback to device
      await SpotifyService.transferPlayback(accessToken, device_id.trim());

      // Update user's current device ID
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      user.currentDeviceId = device_id.trim();
      await user.save();

      res.json({
        success: true,
        message: 'Playback transferred successfully',
        data: {
          deviceId: device_id.trim()
        }
      });
    } catch (error) {
      // If error already has statusCode, pass it through
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      // Log error for debugging
      console.error('Transfer playback error:', {
        error: error.message,
        userId: req.userId,
        deviceId: req.body?.device_id,
        timestamp: new Date().toISOString()
      });

      // Pass to error middleware
      next(error);
    }
  }

  /**
   * Play a specific track on the user's device
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static async playTrack(req, res, next) {
    try {
      const { device_id, track_uri } = req.body;

      // Validate required fields
      if (!device_id || typeof device_id !== 'string' || device_id.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required'
        });
      }

      if (!track_uri || typeof track_uri !== 'string' || track_uri.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Track URI is required'
        });
      }

      // Validate track URI format (should be spotify:track:xxx)
      if (!track_uri.startsWith('spotify:track:')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid track URI format. Expected format: spotify:track:xxx'
        });
      }

      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID not found in request');
        error.statusCode = 401;
        throw error;
      }

      // Get valid Spotify access token (handles refresh if needed)
      const accessToken = await TokenManager.getValidAccessToken(userId);

      // Play the track
      await SpotifyService.playTrack(accessToken, device_id.trim(), track_uri.trim());

      res.json({
        success: true,
        message: 'Track playback started successfully',
        data: {
          deviceId: device_id.trim(),
          trackUri: track_uri.trim()
        }
      });
    } catch (error) {
      // If error already has statusCode, pass it through
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      // Log error for debugging
      console.error('Play track error:', {
        error: error.message,
        userId: req.userId,
        deviceId: req.body?.device_id,
        trackUri: req.body?.track_uri,
        timestamp: new Date().toISOString()
      });

      // Pass to error middleware
      next(error);
    }
  }
}

module.exports = PlayerController;

