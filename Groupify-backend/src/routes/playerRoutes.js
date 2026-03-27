const express = require('express');
const router = express.Router();
const PlayerController = require('../controllers/playerController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * Player Routes
 * Handles Spotify playback control endpoints
 */

// Get available devices (protected)
router.get('/devices', authMiddleware, PlayerController.getAvailableDevices);

// Get current playback state (protected)
router.get('/playback', authMiddleware, PlayerController.getCurrentPlayback);

// Transfer playback to a device (protected)
router.put('/transfer', authMiddleware, PlayerController.transferPlayback);

// Play a specific track on a device (protected)
router.put('/play', authMiddleware, PlayerController.playTrack);

// Pause playback (protected)
router.put('/pause', authMiddleware, PlayerController.pausePlayback);

// Resume playback (protected)
router.put('/resume', authMiddleware, PlayerController.resumePlayback);

// Skip to next track (protected)
router.post('/next', authMiddleware, PlayerController.skipToNext);

// Skip to previous track (protected)
router.post('/previous', authMiddleware, PlayerController.skipToPrevious);

module.exports = router;

