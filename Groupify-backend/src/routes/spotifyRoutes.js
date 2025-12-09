const express = require('express');
const router = express.Router();
const SpotifyController = require('../controllers/spotifyController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * Spotify Routes
 * All routes require authentication
 */

// Search for tracks
router.get('/search', authMiddleware, SpotifyController.searchTracks);

// Get recently played tracks
router.get('/recently-played', authMiddleware, SpotifyController.getRecentlyPlayed);

// Export group to Spotify playlist
router.post(
  '/groups/:groupId/export-playlist',
  authMiddleware,
  SpotifyController.exportGroupToPlaylist
);

module.exports = router;

