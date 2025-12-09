const Group = require('../models/Group');

/**
 * Group Middleware
 * Handles group membership and ownership verification
 */

/**
 * Middleware to verify user is a member of the group
 * Fetches group and attaches it to req.group
 * Returns 404 if group not found, 403 if user is not a member
 */
const isGroupMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Find group and check if user is a member
    const group = await Group.findOne({
      _id: groupId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is a member
    const isMember = group.members.some(
      memberId => memberId.toString() === userId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Attach group to request object for use in controllers
    req.group = group;

    next();
  } catch (error) {
    console.error('Group membership check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying group membership',
      error: error.message
    });
  }
};

/**
 * Middleware to verify user is the owner (creator) of the group
 * Must be used after isGroupMember middleware
 * Returns 403 if user is not the owner
 */
const isGroupOwner = async (req, res, next) => {
  try {
    const userId = req.userId;
    const group = req.group;

    if (!group) {
      return res.status(500).json({
        success: false,
        message: 'Group not found in request. Ensure isGroupMember middleware is used first.'
      });
    }

    // Check if user is the group creator
    if (group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the group owner can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('Group ownership check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying group ownership',
      error: error.message
    });
  }
};

module.exports = {
  isGroupMember,
  isGroupOwner
};

