const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * Authentication Routes
 */

// Initiate Spotify OAuth login
router.get('/login', AuthController.login);

// Test-only login for E2E (only when NODE_ENV=test or E2E_TEST_LOGIN=true)
router.get('/test-login', AuthController.testLogin);

// Handle Spotify OAuth callback
router.get('/callback', AuthController.callback);

// Refresh Spotify access token (protected)
router.post('/refresh', authMiddleware, AuthController.refresh);

// Get current authenticated user (protected)
router.get('/me', authMiddleware, AuthController.getCurrentUser);

// Get Spotify access token for Web Playback SDK (protected)
router.get('/spotify-token', authMiddleware, AuthController.getSpotifyToken);

// Logout user (protected)
router.post('/logout', authMiddleware, AuthController.logout);

module.exports = router;

