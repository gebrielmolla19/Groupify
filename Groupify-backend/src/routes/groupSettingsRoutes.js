const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { isGroupMember, isGroupOwner } = require('../middleware/groupMiddleware');
const { 
  groupIdParamSchema,
  updateGroupSettingsSchema,
  groupIdAndMemberIdSchema,
  validate 
} = require('../validators/groupValidator');

/**
 * Group Settings Routes
 * All routes require authentication and group membership verification
 */

// Get group settings
router.get(
  '/:groupId/settings',
  authMiddleware,
  validate(groupIdParamSchema, 'params'),
  isGroupMember,
  GroupController.getGroupSettings
);

// Update group settings
router.patch(
  '/:groupId/settings',
  authMiddleware,
  validate(groupIdParamSchema, 'params'),
  validate(updateGroupSettingsSchema, 'body'),
  isGroupMember,
  GroupController.updateGroupSettings
);

// Remove a member from group (owner only)
router.delete(
  '/:groupId/members/:memberId',
  authMiddleware,
  validate(groupIdAndMemberIdSchema, 'params'),
  isGroupMember,
  isGroupOwner,
  GroupController.removeGroupMember
);

module.exports = router;

