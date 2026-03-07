const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const config = require('../config/env');
const logger = require('./logger');

/**
 * Token Manager Utility
 * Handles Spotify token refresh and validation
 * Supports multi-app workaround: uses correct credentials per user.spotifyAppIndex
 */
class TokenManager {
  /**
   * Get a valid access token for a user, refreshing if necessary
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<string>} Valid access token
   */
  static async getValidAccessToken(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Check if token is expired (with 5 minute buffer)
      const expiresAt = new Date(user.tokenExpiresAt);
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      const now = new Date();

      if (now.getTime() >= expiresAt.getTime() - bufferTime) {
        logger.info('[TokenManager] Spotify token expired or expiring soon — refreshing', {
          userId,
          expiresAt: expiresAt.toISOString(),
          bufferMs: bufferTime
        });
        return await this.refreshUserToken(userId, user);
      }

      logger.debug('[TokenManager] Returning existing valid Spotify token', {
        userId,
        expiresAt: expiresAt.toISOString()
      });

      return user.spotifyAccessToken;
    } catch (error) {
      logger.error('[TokenManager] Failed to get valid access token', {
        userId,
        error: error.message
      });
      throw new Error(`Failed to get valid access token: ${error.message}`);
    }
  }

  /**
   * Refresh a user's Spotify access token
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<string>} New access token
   */
  static async refreshUserToken(userId, existingUser = null) {
    try {
      logger.info('[TokenManager] Refreshing Spotify access token', { userId });

      const user = existingUser ?? await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const spotifyConfig = config.spotify.getConfig(user.spotifyAppIndex ?? 0);
      const tokenData = await SpotifyService.refreshAccessToken(user.spotifyRefreshToken, spotifyConfig);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

      // Update user with new token
      user.spotifyAccessToken = tokenData.accessToken;
      if (tokenData.refreshToken) {
        user.spotifyRefreshToken = tokenData.refreshToken;
      }
      user.tokenExpiresAt = expiresAt;
      await user.save();

      logger.info('[TokenManager] Spotify access token refreshed successfully', {
        userId,
        newExpiresAt: expiresAt.toISOString(),
        refreshTokenRotated: !!tokenData.refreshToken
      });

      return tokenData.accessToken;
    } catch (error) {
      logger.error('[TokenManager] Failed to refresh Spotify token', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to refresh user token: ${error.message}`);
    }
  }

  /**
   * Check if a user's token is valid (not expired)
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<boolean>} True if token is valid
   */
  static async isTokenValid(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return false;
      }

      const expiresAt = new Date(user.tokenExpiresAt);
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      const now = new Date();

      const isValid = now.getTime() < expiresAt.getTime() - bufferTime;

      logger.debug('[TokenManager] Token validity check', {
        userId,
        isValid,
        expiresAt: expiresAt.toISOString()
      });

      return isValid;
    } catch (error) {
      logger.error('[TokenManager] Error checking token validity', {
        userId,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = TokenManager;
