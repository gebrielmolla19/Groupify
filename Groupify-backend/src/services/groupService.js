const Group = require('../models/Group');
const User = require('../models/User');
const Invite = require('../models/Invite');
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Group Service
 * Contains all business logic for group management
 */
class GroupService {
  /**
   * Create a new group
   * @param {string} userId - User ID creating the group
   * @param {string} name - Group name
   * @param {string} description - Group description (optional)
   * @returns {Promise<Object>} Created group with populated fields
   */
  static async createGroup(userId, name, description = '') {
    // Generate unique invite code
    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const group = new Group({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: userId,
      inviteCode,
      members: [userId]
    });

    await group.save();

    // Add group to user's groups array
    await User.findByIdAndUpdate(userId, {
      $push: { groups: group._id }
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'displayName profileImage spotifyId')
      .populate('members', 'displayName profileImage spotifyId');

    return populatedGroup;
  }

  /**
   * Get all groups for a user, sorted by when they joined/created them (most recent first)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of groups sorted by join/creation time
   */
  static async getUserGroups(userId) {
    // Get all groups the user is a member of
    const groups = await Group.find({
      members: userId,
      isActive: true
    })
      .populate('createdBy', 'displayName profileImage spotifyId')
      .populate('members', 'displayName profileImage spotifyId')
      .lean();

    // Get all accepted invites for this user to determine join dates
    const acceptedInvites = await Invite.find({
      invitedUser: userId,
      status: 'accepted'
    })
      .select('group updatedAt createdAt')
      .lean();

    // Create a map of groupId -> join date (from invite)
    const joinDateMap = new Map();
    acceptedInvites.forEach(invite => {
      const groupId = invite.group.toString();
      // Use updatedAt (when invite was accepted) or createdAt if they're the same
      const joinDate = invite.updatedAt > invite.createdAt 
        ? invite.updatedAt 
        : invite.createdAt;
      joinDateMap.set(groupId, joinDate);
    });

    // Add join date to each group and sort
    const groupsWithJoinDate = groups.map(group => {
      const groupId = group._id.toString();
      let joinDate;

      // If user is the creator, use group creation date
      if (group.createdBy.toString() === userId.toString()) {
        joinDate = group.createdAt;
      } else {
        // Otherwise, use the invite acceptance date
        joinDate = joinDateMap.get(groupId) || group.createdAt; // Fallback to group creation if no invite found
      }

      return {
        ...group,
        _joinDate: joinDate // Add join date for sorting
      };
    });

    // Sort by join date (most recent first)
    groupsWithJoinDate.sort((a, b) => {
      const dateA = new Date(a._joinDate).getTime();
      const dateB = new Date(b._joinDate).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    // Remove the temporary _joinDate field before returning
    return groupsWithJoinDate.map(({ _joinDate, ...group }) => group);
  }

  /**
   * Get group by ID
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (to verify membership)
   * @returns {Promise<Object>} Group details
   * @throws {Error} If group not found or user is not a member
   */
  static async getGroupById(groupId, userId) {
    const group = await Group.findOne({
      _id: groupId,
      members: userId,
      isActive: true
    })
      .populate('createdBy', 'displayName profileImage spotifyId')
      .populate('members', 'displayName profileImage spotifyId');

    if (!group) {
      const error = new Error('Group not found or you are not a member');
      error.statusCode = 404;
      throw error;
    }

    return group;
  }

  /**
   * Join a group using invite code
   * @param {string} userId - User ID joining the group
   * @param {string} inviteCode - Group invite code
   * @returns {Promise<Object>} Joined group with populated fields
   * @throws {Error} If invite code invalid or user already member
   */
  static async joinGroup(userId, inviteCode) {
    const group = await Group.findOne({
      inviteCode: inviteCode.toUpperCase(),
      isActive: true
    });

    if (!group) {
      const error = new Error('Invalid invite code or group not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      const error = new Error('You are already a member of this group');
      error.statusCode = 400;
      throw error;
    }

    // Add user to group
    group.members.push(userId);
    await group.save();

    // Add group to user's groups array
    await User.findByIdAndUpdate(userId, {
      $push: { groups: group._id }
    });

    // Create invite record for analytics tracking (code-join type)
    try {
      const invite = new Invite({
        group: group._id,
        invitedUser: userId,
        invitedBy: group.createdBy, // Group creator is the inviter for code joins
        status: 'accepted',
        type: 'code'
      });
      await invite.save();
    } catch (inviteError) {
      // Log error but don't fail the join if invite record creation fails
      console.error('Failed to create invite record for code join:', inviteError);
    }

    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'displayName profileImage spotifyId')
      .populate('members', 'displayName profileImage spotifyId');

    return populatedGroup;
  }

  /**
   * Leave a group
   * @param {string} groupId - Group ID to leave
   * @param {string} userId - User ID leaving the group
   * @returns {Promise<Object>} Success message
   * @throws {Error} If user is not a member or is the creator
   */
  static async leaveGroup(groupId, userId) {
    const group = await Group.findOne({
      _id: groupId,
      isActive: true
    });

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is a member
    if (!group.members.includes(userId)) {
      const error = new Error('You are not a member of this group');
      error.statusCode = 400;
      throw error;
    }

    // Prevent group creator from leaving
    if (group.createdBy.toString() === userId.toString()) {
      const error = new Error('Group creator cannot leave the group. Please transfer ownership or delete the group.');
      error.statusCode = 403;
      throw error;
    }

    // Remove user from group
    group.members = group.members.filter(
      memberId => memberId.toString() !== userId.toString()
    );
    await group.save();

    // Remove group from user's groups array
    await User.findByIdAndUpdate(userId, {
      $pull: { groups: groupId }
    });

    return {
      message: 'Successfully left the group',
      groupId: group._id,
      groupName: group.name
    };
  }

  /**
   * Get group settings (name, description, members)
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (to verify membership)
   * @returns {Promise<Object>} Group settings with populated members
   * @throws {Error} If group not found or user is not a member
   */
  static async getGroupSettings(groupId, userId) {
    const group = await Group.findOne({
      _id: groupId,
      members: userId,
      isActive: true
    })
      .populate('members', 'displayName profileImage spotifyId')
      .lean();

    if (!group) {
      const error = new Error('Group not found or you are not a member');
      error.statusCode = 404;
      throw error;
    }

    // Format members to only include id, displayName, profileImage
    const formattedMembers = group.members.map(member => ({
      id: member._id.toString(),
      displayName: member.displayName,
      profileImage: member.profileImage || null
    }));

    return {
      name: group.name,
      description: group.description || '',
      members: formattedMembers
    };
  }

  /**
   * Update group settings (name and/or description)
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (must be a member)
   * @param {Object} updates - Object with name and/or description
   * @returns {Promise<Object>} Updated group settings
   * @throws {Error} If group not found, user is not a member, or validation fails
   */
  static async updateGroupSettings(groupId, userId, updates) {
    const group = await Group.findOne({
      _id: groupId,
      members: userId,
      isActive: true
    });

    if (!group) {
      const error = new Error('Group not found or you are not a member');
      error.statusCode = 404;
      throw error;
    }

    // Update fields if provided
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length > 100) {
        const error = new Error('Group name cannot exceed 100 characters');
        error.statusCode = 400;
        throw error;
      }
      group.name = trimmedName;
    }

    if (updates.description !== undefined) {
      const trimmedDescription = updates.description.trim();
      if (trimmedDescription.length > 500) {
        const error = new Error('Description cannot exceed 500 characters');
        error.statusCode = 400;
        throw error;
      }
      group.description = trimmedDescription;
    }

    await group.save();

    // Return updated settings with populated members
    const updatedGroup = await Group.findById(group._id)
      .populate('members', 'displayName profileImage spotifyId')
      .lean();

    const formattedMembers = updatedGroup.members.map(member => ({
      id: member._id.toString(),
      displayName: member.displayName,
      profileImage: member.profileImage || null
    }));

    return {
      name: updatedGroup.name,
      description: updatedGroup.description || '',
      members: formattedMembers
    };
  }

  /**
   * Remove a member from a group (owner only)
   * @param {string} groupId - Group ID
   * @param {string} ownerId - Owner/creator user ID
   * @param {string} memberId - Member ID to remove
   * @returns {Promise<Object>} Success message
   * @throws {Error} If group not found, user is not owner, or member not found
   */
  static async removeGroupMember(groupId, ownerId, memberId) {
    const group = await Group.findOne({
      _id: groupId,
      isActive: true
    });

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is the owner
    if (group.createdBy.toString() !== ownerId.toString()) {
      const error = new Error('Only the group owner can remove members');
      error.statusCode = 403;
      throw error;
    }

    // Prevent removing the owner
    if (group.createdBy.toString() === memberId.toString()) {
      const error = new Error('Cannot remove the group owner');
      error.statusCode = 400;
      throw error;
    }

    // Check if member exists in group
    const memberIndex = group.members.findIndex(
      m => m.toString() === memberId.toString()
    );

    if (memberIndex === -1) {
      const error = new Error('Member not found in group');
      error.statusCode = 404;
      throw error;
    }

    // Remove member from group
    group.members.splice(memberIndex, 1);
    await group.save();

    // Remove group from user's groups array
    await User.findByIdAndUpdate(memberId, {
      $pull: { groups: groupId }
    });

    return {
      message: 'Member removed successfully',
      groupId: group._id.toString(),
      memberId: memberId
    };
  }

  /**
   * Delete a group (owner only)
   * Soft deletes by setting isActive to false
   * Also removes group from all members' groups array
   * @param {string} groupId - Group ID to delete
   * @param {string} ownerId - Owner/creator user ID
   * @returns {Promise<Object>} Success message
   * @throws {Error} If group not found or user is not owner
   */
  static async deleteGroup(groupId, ownerId) {
    const group = await Group.findOne({
      _id: groupId,
      isActive: true
    });

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is the owner
    if (group.createdBy.toString() !== ownerId.toString()) {
      const error = new Error('Only the group owner can delete the group');
      error.statusCode = 403;
      throw error;
    }

    // Soft delete: set isActive to false
    group.isActive = false;
    await group.save();

    // Remove group from all members' groups array
    await User.updateMany(
      { groups: groupId },
      { $pull: { groups: groupId } }
    );

    return {
      message: 'Group deleted successfully',
      groupId: group._id.toString(),
      groupName: group.name
    };
  }
}

module.exports = GroupService;

