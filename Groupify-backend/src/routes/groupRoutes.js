const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const AnalyticsController = require('../controllers/analyticsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createGroupSchema,
  joinGroupSchema,
  groupIdSchema,
  validate
} = require('../validators/groupValidator');

/**
 * Group Routes
 * All routes require authentication and input validation
 */

// Create a new group
router.post(
  '/',
  authMiddleware,
  validate(createGroupSchema, 'body'),
  GroupController.createGroup
);

// Get all groups for the current user
router.get('/', authMiddleware, GroupController.getUserGroups);

// Join a group using invite code only (no groupId required)
router.post(
  '/join',
  authMiddleware,
  validate(joinGroupSchema, 'body'),
  GroupController.joinGroupByCode
);

// Get group details by ID
router.get(
  '/:id',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  GroupController.getGroupById
);

// Join a group using invite code
router.post(
  '/:id/join',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  validate(joinGroupSchema, 'body'),
  GroupController.joinGroup
);

// Leave a group
router.post(
  '/:id/leave',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  GroupController.leaveGroup
);

// Analytics Routes
router.get('/:id/analytics/activity', authMiddleware, AnalyticsController.getGroupActivity);
router.get('/:id/analytics/vibes', authMiddleware, AnalyticsController.getMemberVibes);
router.get('/:id/analytics/superlatives', authMiddleware, AnalyticsController.getSuperlatives);


module.exports = router;

