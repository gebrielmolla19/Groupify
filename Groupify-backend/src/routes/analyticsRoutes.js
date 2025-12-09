const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * Analytics Routes
 * All routes require authentication
 */

// Get group activity (waveform)
router.get('/:id/activity', authMiddleware, AnalyticsController.getGroupActivity);

// Get member stats (solar system)
router.get('/:id/members', authMiddleware, AnalyticsController.getMemberStats);

// Get superlatives (hall of fame)
router.get('/:id/superlatives', authMiddleware, AnalyticsController.getSuperlatives);

module.exports = router;

