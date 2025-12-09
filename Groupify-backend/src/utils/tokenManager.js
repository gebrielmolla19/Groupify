const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');

/**
 * Token Manager Utility
 * Handles Spotify token refresh and validation
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
        // Token expired or about to expire, refresh it
        return await this.refreshUserToken(userId);
      }

      return user.spotifyAccessToken;
    } catch (error) {
      throw new Error(`Failed to get valid access token: ${error.message}`);
    }
  }

  /**
   * Refresh a user's Spotify access token
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<string>} New access token
   */
  static async refreshUserToken(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const tokenData = await SpotifyService.refreshAccessToken(user.spotifyRefreshToken);

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

      return tokenData.accessToken;
    } catch (error) {
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

      return now.getTime() < expiresAt.getTime() - bufferTime;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TokenManager;

