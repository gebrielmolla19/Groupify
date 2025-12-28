const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { isGroupMember } = require('../middleware/groupMiddleware');

/**
 * Analytics Routes
 * All routes require authentication
 */

// Get group activity (waveform)
router.get('/:id/activity', authMiddleware, AnalyticsController.getGroupActivity);

// Get member vibes (radar chart)
router.get('/:id/vibes', authMiddleware, AnalyticsController.getMemberVibes);

// Get superlatives (hall of fame)
router.get('/:id/superlatives', authMiddleware, AnalyticsController.getSuperlatives);

// Get listener reflex analytics
// Note: isGroupMember expects req.params.groupId, so we need to map :id to groupId
router.get('/:id/listener-reflex', authMiddleware, (req, res, next) => {
  req.params.groupId = req.params.id;
  next();
}, isGroupMember, AnalyticsController.getListenerReflex);

module.exports = router;

