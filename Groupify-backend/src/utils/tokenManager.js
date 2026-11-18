const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const config = require('../config/env');
const logger = require('./logger');
const { createSpotifyReauthError, isSpotifyReauthError, SPOTIFY_NEW_SCOPES_MESSAGE } = require('./spotifyReauth');
const { hasRequiredScopes } = require('../config/spotifyScopes');

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

      // Tokens are cleared when Spotify rejects the refresh token; don't ask
      // Spotify again until the user signs in again.
      if (!user.spotifyRefreshToken) {
        throw createSpotifyReauthError();
      }

      // Refreshing can't add scopes, so a user whose grant predates a scope
      // Groupify now asks for has to sign in again to get it.
      if (!hasRequiredScopes(user.spotifyScopes)) {
        logger.info('[TokenManager] Stored Spotify grant is missing scopes; asking the user to sign in again', { userId });
        throw createSpotifyReauthError(SPOTIFY_NEW_SCOPES_MESSAGE);
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
      if (isSpotifyReauthError(error)) {
        throw error;
      }
      logger.error('[TokenManager] Failed to get valid access token', {
        userId,
        error: error.message
      });
      throw new Error(`Failed to get valid access token: ${error.message}`);
    }
  }

  /**
   * Run a Spotify call with the user's access token. If Spotify answers 401
   * for a token we still think is valid (revoked early, clock skew), refresh
   * once and retry once; a second 401 is passed on. A refresh token Spotify
   * rejects ends in the usual "sign in again" error.
   * @param {string} userId - User MongoDB ID
   * @param {(accessToken: string) => Promise<T>} call - The Spotify call
   * @returns {Promise<T>}
   * @template T
   */
  static async withValidAccessToken(userId, call) {
    const accessToken = await this.getValidAccessToken(userId);
    try {
      return await call(accessToken);
    } catch (error) {
      const spotifyStatus = isSpotifyReauthError(error) ? null : (error.statusCode ?? error.response?.status);
      if (spotifyStatus !== 401) throw error;

      logger.info('[TokenManager] Spotify rejected the access token; refreshing once and retrying', { userId });
      let freshToken;
      try {
        freshToken = await this.refreshUserToken(userId);
      } catch (refreshError) {
        if (isSpotifyReauthError(refreshError)) throw refreshError;
        // Couldn't refresh (network, Spotify down): report the original 401.
        throw error;
      }
      return call(freshToken);
    }
  }

  /**
   * Refresh a user's Spotify access token
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<string>} New access token
   */
  static async refreshUserToken(userId, existingUser = null) {
    let rejectedRefreshToken = null;
    try {
      logger.info('[TokenManager] Refreshing Spotify access token', { userId });

      const user = existingUser ?? await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const spotifyConfig = config.spotify.getConfig(user.spotifyAppIndex ?? 0);
      rejectedRefreshToken = user.spotifyRefreshToken;
      const tokenData = await SpotifyService.refreshAccessToken(user.spotifyRefreshToken, spotifyConfig);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

      // Update user with new token
      user.spotifyAccessToken = tokenData.accessToken;
      if (tokenData.refreshToken) {
        user.spotifyRefreshToken = tokenData.refreshToken;
      }
      if (tokenData.scope) {
        user.spotifyScopes = tokenData.scope;
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
      if (isSpotifyReauthError(error)) {
        if (rejectedRefreshToken) {
          await this.clearSpotifyTokens(userId, rejectedRefreshToken);
        }
        throw error;
      }
      logger.error('[TokenManager] Failed to refresh Spotify token', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to refresh user token: ${error.message}`);
    }
  }

  /**
   * Forget a user's Spotify tokens after Spotify rejected the refresh token,
   * so later requests answer "sign in again" without calling Spotify.
   * Signing in with Spotify stores new ones.
   *
   * Only clears if the stored refresh token is still the rejected one: a
   * sign-in that finished while Spotify was answering must not be undone.
   * @param {string} userId - User MongoDB ID
   * @param {string} rejectedRefreshToken - The refresh token Spotify rejected
   */
  static async clearSpotifyTokens(userId, rejectedRefreshToken) {
    await User.updateOne(
      { _id: userId, spotifyRefreshToken: rejectedRefreshToken },
      { $unset: { spotifyAccessToken: '', spotifyRefreshToken: '', tokenExpiresAt: '' } }
    );
    logger.warn('[TokenManager] Spotify refresh token rejected; cleared stored Spotify tokens', { userId });
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
