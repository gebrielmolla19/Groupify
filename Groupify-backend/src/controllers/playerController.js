const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const TokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');

/**
 * Player Controller
 * Handles Spotify playback control operations
 */
class PlayerController {
  /**
   * Get the user's available Spotify Connect devices
   */
  static async getAvailableDevices(req, res, next) {
    try {
      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID not found in request');
        error.statusCode = 401;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(userId);
      const devices = await SpotifyService.getAvailableDevices(accessToken);

      logger.debug('[Player] Available devices fetched', {
        userId,
        deviceCount: devices?.length ?? 0
      });

      res.json({
        success: true,
        devices
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      logger.error('[Player] Failed to get available devices', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });

      next(error);
    }
  }

  /**
   * Transfer playback to a specific device
   */
  static async transferPlayback(req, res, next) {
    try {
      const { device_id, play } = req.body;

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

      const accessToken = await TokenManager.getValidAccessToken(userId);
      await SpotifyService.transferPlayback(accessToken, device_id.trim(), Boolean(play));

      const user = await User.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      user.currentDeviceId = device_id.trim();
      await user.save();

      logger.info('[Player] Playback transferred to device', {
        userId,
        deviceId: device_id.trim(),
        play: Boolean(play)
      });

      res.json({
        success: true,
        message: play ? 'Playback transferred and resumed' : 'Playback transferred successfully',
        data: { deviceId: device_id.trim() }
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      logger.error('[Player] Failed to transfer playback', {
        userId: req.userId,
        deviceId: req.body?.device_id,
        error: error.message,
        stack: error.stack
      });

      next(error);
    }
  }

  /**
   * Get current playback state (what's playing on any device)
   */
  static async getCurrentPlayback(req, res, next) {
    try {
      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID not found in request');
        error.statusCode = 401;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(userId);
      const playback = await SpotifyService.getCurrentPlayback(accessToken);

      logger.debug('[Player] Current playback state fetched', {
        userId,
        isPlaying: playback?.is_playing ?? false,
        trackId: playback?.item?.id
      });

      res.json({
        success: true,
        playback: playback || null
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      logger.error('[Player] Failed to get current playback', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });

      next(error);
    }
  }

  /**
   * Play a specific track on the user's device
   */
  static async playTrack(req, res, next) {
    try {
      const { device_id, track_uri } = req.body;

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

      const accessToken = await TokenManager.getValidAccessToken(userId);
      await SpotifyService.playTrack(accessToken, device_id.trim(), track_uri.trim());

      logger.info('[Player] Track playback started', {
        userId,
        deviceId: device_id.trim(),
        trackUri: track_uri.trim()
      });

      res.json({
        success: true,
        message: 'Track playback started successfully',
        data: {
          deviceId: device_id.trim(),
          trackUri: track_uri.trim()
        }
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      logger.error('[Player] Failed to start track playback', {
        userId: req.userId,
        deviceId: req.body?.device_id,
        trackUri: req.body?.track_uri,
        error: error.message,
        stack: error.stack
      });

      next(error);
    }
  }
}

module.exports = PlayerController;
