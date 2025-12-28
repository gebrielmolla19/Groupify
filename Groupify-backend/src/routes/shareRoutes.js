const express = require('express');
const router = express.Router();
const ShareController = require('../controllers/shareController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  shareSongSchema,
  groupFeedQuerySchema,
  shareIdSchema,
  groupIdParamSchema,
  validate
} = require('../validators/shareValidator');

/**
 * Share Routes
 * All routes require authentication and input validation
 */

// Share a song to a group
router.post(
  '/',
  authMiddleware,
  validate(shareSongSchema, 'body'),
  ShareController.shareSong
);

// Get group feed (all shared songs for a group)
router.get(
  '/groups/:groupId',
  authMiddleware,
  validate(groupIdParamSchema, 'params'),
  validate(groupFeedQuerySchema, 'query'),
  ShareController.getGroupFeed
);

// Mark a share as listened
router.post(
  '/:shareId/listen',
  authMiddleware,
  validate(shareIdSchema, 'params'),
  ShareController.markAsListened
);

// Unmark a share as listened
router.delete(
  '/:shareId/listen',
  authMiddleware,
  validate(shareIdSchema, 'params'),
  ShareController.unmarkAsListened
);

// Toggle like on a share
router.put(
  '/:shareId/like',
  authMiddleware,
  validate(shareIdSchema, 'params'),
  ShareController.toggleLike
);

// Remove a share from a group
router.delete(
  '/:shareId',
  authMiddleware,
  validate(shareIdSchema, 'params'),
  ShareController.removeShare
);

module.exports = router;
