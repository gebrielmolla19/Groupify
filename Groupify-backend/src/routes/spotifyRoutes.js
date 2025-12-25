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

// Export group to Spotify playlist (create/update - owner only)
router.post(
  '/groups/:groupId/export-playlist',
  authMiddleware,
  SpotifyController.exportGroupToPlaylist
);

// Follow group's collaborative playlist (for non-owners)
router.post(
  '/groups/:groupId/follow-playlist',
  authMiddleware,
  SpotifyController.followGroupPlaylist
);

module.exports = router;

