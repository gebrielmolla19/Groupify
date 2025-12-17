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

// Transfer playback to a device (protected)
router.put('/transfer', authMiddleware, PlayerController.transferPlayback);

// Play a specific track on a device (protected)
router.put('/play', authMiddleware, PlayerController.playTrack);

module.exports = router;

