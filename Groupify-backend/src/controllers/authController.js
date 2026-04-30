const crypto = require('crypto');
const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');
const config = require('../config/env');
const logger = require('../utils/logger');

// In-memory store for one-time auth codes (single-server dev use)
const authCodes = new Map();

// Purge expired codes every 60 seconds to prevent map growth
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (entry.expiresAt <= now) {
      authCodes.delete(code);
    }
  }
}, 60_000);

/**
 * Authentication Controller
 * Handles Spotify OAuth flow and user authentication
 * Supports multiple Spotify apps (Option 1 workaround for 5-user dev mode limit)
 */
class AuthController {
  /**
   * Initiate Spotify OAuth login
   * Redirects user to Spotify authorization page
   * Query param: ?app=0|1|2 - which Spotify app to use (default 0)
   */
  static async login(req, res, next) {
    try {
      const appIndex = Math.max(0, parseInt(req.query.app, 10) || 0);
      const spotifyConfig = config.spotify.getConfig(appIndex);

      if (!spotifyConfig) {
        const err = new Error('Spotify app configuration not found');
        err.statusCode = 500;
        throw err;
      }

      logger.info('[Auth] Initiating Spotify OAuth login', {
        appIndex,
        ip: req.ip
      });

      const scopes = [
        'user-read-email',
        'user-read-private',
        'user-read-recently-played',
        'user-read-playback-state',
        'user-read-currently-playing',
        'user-modify-playback-state',
        'playlist-modify-private',
        'playlist-read-private',
        'streaming'
      ].join(' ');

      // Pass app index in state so callback knows which credentials to use
      const state = `app:${appIndex}`;

      const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${spotifyConfig.clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(config.spotify.redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `state=${encodeURIComponent(state)}`;

      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Spotify OAuth callback
   * Exchange code for tokens and create/update user
   */
  static async callback(req, res, next) {
    try {
      const { code, error, state } = req.query;

      if (error) {
        logger.warn('[Auth] Spotify authorization denied by user', {
          spotifyError: error,
          ip: req.ip
        });
        const err = new Error('Spotify authorization failed');
        err.statusCode = 400;
        throw err;
      }

      if (!code) {
        const err = new Error('Authorization code not provided');
        err.statusCode = 400;
        throw err;
      }

      // Parse app index from state (multi-app workaround)
      let appIndex = 0;
      if (state && typeof state === 'string' && state.startsWith('app:')) {
        const parsed = parseInt(state.replace('app:', ''), 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          appIndex = parsed;
        }
      }

      const spotifyConfig = config.spotify.getConfig(appIndex);
      if (!spotifyConfig) {
        const err = new Error('Spotify app configuration not found');
        err.statusCode = 500;
        throw err;
      }

      // Exchange code for tokens (use credentials for this app)
      let tokenData;
      try {
        tokenData = await SpotifyService.exchangeCodeForToken(code, spotifyConfig);
      } catch (error) {
        logger.error('[Auth] Token exchange failed', {
          error: error.message,
          spotifyError: error.spotifyError,
          codeProvided: !!code
        });
        const err = new Error(`Failed to exchange authorization code: ${error.message}`);
        err.statusCode = error.statusCode || 400;
        err.spotifyError = error.spotifyError;
        throw err;
      }

      // Validate token data
      if (!tokenData || !tokenData.accessToken) {
        const err = new Error('Invalid token data received from Spotify');
        err.statusCode = 500;
        throw err;
      }

      // Get user profile from Spotify
      let spotifyProfile;
      try {
        spotifyProfile = await SpotifyService.getUserProfile(tokenData.accessToken);
      } catch (error) {
        logger.error('[Auth] Failed to fetch Spotify user profile', {
          error: error.message,
          spotifyError: error.spotifyError,
          spotifyErrorDetails: error.spotifyErrorDetails,
          statusCode: error.statusCode
        });

        const err = new Error(error.message || 'Failed to fetch user profile from Spotify');
        err.statusCode = error.statusCode || 500;
        err.spotifyError = error.spotifyError;
        err.spotifyErrorDetails = error.spotifyErrorDetails;
        err.details = error.details;
        throw err;
      }

      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

      // Create or update user
      let user = await User.findOne({ spotifyId: spotifyProfile.id });
      const isNewUser = !user;

      if (user) {
        user.spotifyAccessToken = tokenData.accessToken;
        user.spotifyRefreshToken = tokenData.refreshToken;
        user.tokenExpiresAt = expiresAt;
        user.displayName = spotifyProfile.display_name || spotifyProfile.id;
        user.email = spotifyProfile.email || user.email;
        user.profileImage = spotifyProfile.images?.[0]?.url || user.profileImage;
        user.isActive = true;
        user.spotifyAppIndex = appIndex;
        await user.save();
      } else {
        user = new User({
          spotifyId: spotifyProfile.id,
          displayName: spotifyProfile.display_name || spotifyProfile.id,
          email: spotifyProfile.email || null,
          profileImage: spotifyProfile.images?.[0]?.url || null,
          spotifyAccessToken: tokenData.accessToken,
          spotifyRefreshToken: tokenData.refreshToken,
          tokenExpiresAt: expiresAt,
          spotifyAppIndex: appIndex
        });
        await user.save();
      }

      logger.info(isNewUser ? '[Auth] New user registered via Spotify' : '[Auth] Existing user logged in', {
        userId: user._id?.toString(),
        spotifyId: spotifyProfile.id,
        displayName: spotifyProfile.display_name,
        appIndex,
        isNewUser
      });

      // Generate one-time auth code instead of exposing JWT in URL
      const authCode = crypto.randomBytes(16).toString('hex');
      authCodes.set(authCode, { userId: user._id.toString(), expiresAt: Date.now() + 30_000 });

      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?code=${authCode}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test-only login: create/find a test user and redirect to frontend with one-time code.
   * Only enabled when NODE_ENV=test or E2E_TEST_LOGIN=true.
   * Used by E2E tests to log in without Spotify OAuth.
   */
  static async testLogin(req, res, next) {
    const allowed = process.env.NODE_ENV === 'test' || process.env.E2E_TEST_LOGIN === 'true';
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    try {
      const spotifyId = 'e2e-test-user';
      let user = await User.findOne({ spotifyId });

      if (!user) {
        const expiresAt = new Date(Date.now() + 3600000);
        user = new User({
          spotifyId,
          displayName: 'E2E Test User',
          email: 'e2e@test.example',
          spotifyAccessToken: 'e2e-test-access',
          spotifyRefreshToken: 'e2e-test-refresh',
          tokenExpiresAt: expiresAt
        });
        await user.save();
        logger.info('[Auth] E2E test user created', { userId: user._id?.toString() });
      }

      const authCode = crypto.randomBytes(16).toString('hex');
      authCodes.set(authCode, { userId: user._id.toString(), expiresAt: Date.now() + 30_000 });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?code=${authCode}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exchange a one-time auth code for a JWT token
   */
  static async exchangeCode(req, res, next) {
    try {
      const { code } = req.body;

      if (!code) {
        const error = new Error('Auth code required');
        error.statusCode = 400;
        throw error;
      }

      const entry = authCodes.get(code);

      if (!entry || entry.expiresAt <= Date.now()) {
        authCodes.delete(code);
        const error = new Error('Invalid or expired auth code');
        error.statusCode = 400;
        throw error;
      }

      // One-time use: delete immediately
      authCodes.delete(code);

      const token = generateToken(entry.userId);

      res.json({ success: true, token });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh user's Spotify access token
   */
  static async refresh(req, res, next) {
    try {
      const userId = req.userId;

      if (!userId) {
        const error = new Error('User ID required');
        error.statusCode = 400;
        throw error;
      }

      const user = await User.findById(userId);

      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      const spotifyConfig = config.spotify.getConfig(user.spotifyAppIndex ?? 0);
      const tokenData = await SpotifyService.refreshAccessToken(user.spotifyRefreshToken, spotifyConfig);

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

      user.spotifyAccessToken = tokenData.accessToken;
      if (tokenData.refreshToken) {
        user.spotifyRefreshToken = tokenData.refreshToken;
      }
      user.tokenExpiresAt = expiresAt;
      await user.save();

      logger.info('[Auth] Spotify token refreshed via API', {
        userId,
        userDisplayName: user.displayName,
        newExpiresAt: expiresAt.toISOString()
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        expiresAt
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user
   */
  static async getCurrentUser(req, res, next) {
    try {
      const user = await User.findById(req.userId)
        .populate('groups', 'name description createdAt')
        .select('-spotifyAccessToken -spotifyRefreshToken');

      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      logger.debug('[Auth] Current user profile fetched', {
        userId: req.userId,
        userDisplayName: user.displayName
      });

      res.json({
        success: true,
        user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Spotify access token for Web Playback SDK
   * Returns the user's Spotify access token (refreshed if needed)
   */
  static async getSpotifyToken(req, res, next) {
    try {
      const userId = req.userId;
      const TokenManager = require('../utils/tokenManager');

      const spotifyToken = await TokenManager.getValidAccessToken(userId);

      logger.debug('[Auth] Spotify SDK token vended', {
        userId,
        userDisplayName: req.user?.displayName
      });

      res.json({
        success: true,
        accessToken: spotifyToken
      });
    } catch (error) {
      logger.error('[Auth] Failed to vend Spotify SDK token', {
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Refresh an expired JWT token without requiring Spotify re-auth.
   * Decodes the expired token, verifies the user still exists and has a valid
   * Spotify refresh token, then issues a fresh JWT.
   */
  static async refreshJwt(req, res, next) {
    try {
      const { token } = req.body;

      if (!token) {
        const error = new Error('Token is required');
        error.statusCode = 400;
        throw error;
      }

      // Decode the JWT without verifying expiry
      const jwt = require('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      } catch {
        const error = new Error('Invalid token');
        error.statusCode = 401;
        throw error;
      }

      // Verify user still exists and has a Spotify refresh token
      const user = await User.findById(decoded.userId).select('spotifyRefreshToken isActive');

      if (!user || !user.isActive) {
        const error = new Error('User not found or inactive');
        error.statusCode = 401;
        throw error;
      }

      if (!user.spotifyRefreshToken) {
        const error = new Error('No Spotify session — please log in again');
        error.statusCode = 401;
        throw error;
      }

      const newToken = generateToken(decoded.userId);

      logger.info('[Auth] JWT refreshed', { userId: decoded.userId });

      res.json({ success: true, token: newToken });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * Note: With JWT, logout is primarily client-side (removing the token).
   * This endpoint is for logging/analytics purposes and future token blacklisting.
   */
  static async logout(req, res, next) {
    try {
      const userId = req.userId;

      logger.info('[Auth] User logged out', {
        userId,
        userDisplayName: req.user?.displayName
      });

      // Token blacklisting is intentionally not implemented here. JWTs are
      // stateless; revoking before expiry requires a backing store (Redis or
      // a TTL'd Mongo collection) checked on every authenticated request.
      // That's a design decision that needs its own RFC — keeping logout
      // client-driven (clear the token) until then.

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
