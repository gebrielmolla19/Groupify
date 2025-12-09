const express = require('express');
const router = express.Router();
const InviteController = require('../controllers/inviteController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  inviteUserSchema,
  groupIdSchema,
  inviteIdSchema,
  groupIdAndInviteIdSchema,
  validate
} = require('../validators/inviteValidator');

/**
 * Invite Routes
 * All routes require authentication and input validation
 */

// Create a new invite
router.post(
  '/:groupId/invite',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  validate(inviteUserSchema, 'body'),
  InviteController.createInvite
);

// Accept an invite
router.post(
  '/:groupId/invite/:inviteId/accept',
  authMiddleware,
  validate(groupIdAndInviteIdSchema, 'params'),
  InviteController.acceptInvite
);

// Decline an invite
router.post(
  '/:groupId/invite/:inviteId/decline',
  authMiddleware,
  validate(groupIdAndInviteIdSchema, 'params'),
  InviteController.declineInvite
);

// Get all pending invites for the current user (across all groups)
// IMPORTANT: This route must come BEFORE /:groupId/invites to avoid route conflicts
router.get(
  '/user/invites',
  authMiddleware,
  InviteController.getUserInvites
);

// Get all invites for a group
router.get(
  '/:groupId/invites',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  InviteController.listInvites
);

module.exports = router;

