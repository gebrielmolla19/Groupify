const SpotifyService = require('../services/spotifyService');
const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');

/**
 * Authentication Controller
 * Handles Spotify OAuth flow and user authentication
 */
class AuthController {
  /**
   * Initiate Spotify OAuth login
   * Redirects user to Spotify authorization page
   */
  static async login(req, res, next) {
    try {
      const scopes = [
        'user-read-email',
        'user-read-private',
        'user-read-recently-played',
        'user-read-playback-state',
        'user-read-currently-playing',
        'user-modify-playback-state',
        'streaming'
      ].join(' ');

      const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${process.env.SPOTIFY_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes)}`;

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
      const { code, error } = req.query;

      if (error) {
        const err = new Error('Spotify authorization failed');
        err.statusCode = 400;
        throw err;
      }

      if (!code) {
        const err = new Error('Authorization code not provided');
        err.statusCode = 400;
        throw err;
      }

      // Exchange code for tokens
      let tokenData;
      try {
        // Log client ID being used (first 10 chars for security)
        const clientIdPreview = process.env.SPOTIFY_CLIENT_ID
          ? `${process.env.SPOTIFY_CLIENT_ID.substring(0, 10)}...`
          : 'NOT SET';
        console.log('[Auth] Exchanging code for token with client ID:', clientIdPreview);

        tokenData = await SpotifyService.exchangeCodeForToken(code);

        console.log('[Auth] Token exchange successful:', {
          hasAccessToken: !!tokenData.accessToken,
          hasRefreshToken: !!tokenData.refreshToken,
          expiresIn: tokenData.expiresIn
        });
      } catch (error) {
        console.error('[Auth] Token exchange failed:', {
          error: error.message,
          spotifyError: error.spotifyError,
          code: code ? 'provided' : 'missing',
          timestamp: new Date().toISOString()
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
        console.log('[Auth] Fetching user profile from Spotify...');
        spotifyProfile = await SpotifyService.getUserProfile(tokenData.accessToken);
        console.log('[Auth] User profile fetched successfully:', {
          spotifyId: spotifyProfile.id,
          displayName: spotifyProfile.display_name,
          email: spotifyProfile.email ? 'provided' : 'not provided'
        });
      } catch (error) {
        console.error('[Auth] Failed to fetch user profile:', {
          error: error.message,
          spotifyError: error.spotifyError,
          spotifyErrorDetails: error.spotifyErrorDetails,
          statusCode: error.statusCode,
          hasAccessToken: !!tokenData.accessToken,
          tokenLength: tokenData.accessToken?.length,
          tokenPreview: tokenData.accessToken ? `${tokenData.accessToken.substring(0, 20)}...` : 'N/A',
          timestamp: new Date().toISOString()
        });

        // Re-throw with proper status code
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

      if (user) {
        // Update existing user
        user.spotifyAccessToken = tokenData.accessToken;
        user.spotifyRefreshToken = tokenData.refreshToken;
        user.tokenExpiresAt = expiresAt;
        user.displayName = spotifyProfile.display_name || spotifyProfile.id;
        user.email = spotifyProfile.email || user.email;
        user.profileImage = spotifyProfile.images?.[0]?.url || user.profileImage;
        user.isActive = true;
        await user.save();
      } else {
        // Create new user
        user = new User({
          spotifyId: spotifyProfile.id,
          displayName: spotifyProfile.display_name || spotifyProfile.id,
          email: spotifyProfile.email || null,
          profileImage: spotifyProfile.images?.[0]?.url || null,
          spotifyAccessToken: tokenData.accessToken,
          spotifyRefreshToken: tokenData.refreshToken,
          tokenExpiresAt: expiresAt
        });
        await user.save();
      }

      // Generate JWT token
      const jwtToken = generateToken(user._id);

      // Redirect to frontend with token (adjust URL as needed)
      // In production, you'd want to use a more secure method to pass the token
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${jwtToken}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh user's Spotify access token
   */
  static async refresh(req, res, next) {
    try {
      const userId = req.userId || req.body.userId;

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

      const tokenData = await SpotifyService.refreshAccessToken(user.spotifyRefreshToken);

      // Update user token
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

      user.spotifyAccessToken = tokenData.accessToken;
      if (tokenData.refreshToken) {
        user.spotifyRefreshToken = tokenData.refreshToken;
      }
      user.tokenExpiresAt = expiresAt;
      await user.save();

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

      // Get valid Spotify access token (handles refresh if needed)
      const spotifyToken = await TokenManager.getValidAccessToken(userId);

      res.json({
        success: true,
        accessToken: spotifyToken
      });
    } catch (error) {
      console.error('Get Spotify token error:', error);
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
      const userId = req.user.displayName;

      // Log the logout event (optional - for analytics)
      console.log(`[Auth] User ${userId} logged out at ${new Date().toISOString()}`);

      // TODO: If implementing token blacklisting, add token to blacklist here
      // await TokenBlacklist.create({ token: req.token, expiresAt: req.tokenExp });

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

