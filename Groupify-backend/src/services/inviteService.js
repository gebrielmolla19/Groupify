const Invite = require('../models/Invite');
const Group = require('../models/Group');
const User = require('../models/User');

/**
 * Invite Service
 * Contains all business logic for invite management
 */
class InviteService {
  /**
   * Create a new invite
   * @param {string} groupId - Group ID
   * @param {string} invitedUserSpotifyId - Spotify ID of user to invite
   * @param {string} invitedByUserId - User ID creating the invite
   * @returns {Promise<Object>} Created invite with populated fields
   * @throws {Error} If validation fails or invite creation fails
   */
  static async createInvite(groupId, invitedUserSpotifyId, invitedByUserId) {
    // Find target user by Spotify ID
    const invitedUser = await User.findOne({ 
      spotifyId: invitedUserSpotifyId.trim(),
      isActive: true 
    });

    if (!invitedUser) {
      const error = new Error('User with the provided Spotify ID not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      const error = new Error('Group not found or inactive');
      error.statusCode = 404;
      throw error;
    }

    // Verify inviter is a member of the group
    if (!group.members.includes(invitedByUserId)) {
      const error = new Error('You must be a member of the group to invite others');
      error.statusCode = 403;
      throw error;
    }

    // Prevent inviting yourself
    if (invitedUser._id.toString() === invitedByUserId.toString()) {
      const error = new Error('You cannot invite yourself');
      error.statusCode = 400;
      throw error;
    }

    // Check if user is already a member
    if (group.members.includes(invitedUser._id)) {
      const error = new Error('User is already a member of this group');
      error.statusCode = 400;
      throw error;
    }

    // Check for existing pending invite
    const existingInvite = await Invite.findOne({
      group: groupId,
      invitedUser: invitedUser._id,
      status: 'pending'
    });

    if (existingInvite) {
      const error = new Error('A pending invite already exists for this user');
      error.statusCode = 409;
      throw error;
    }

    // Create invite
    const invite = new Invite({
      group: groupId,
      invitedUser: invitedUser._id,
      invitedBy: invitedByUserId
    });

    await invite.save();

    // Populate and return
    const populatedInvite = await Invite.findById(invite._id)
      .populate('group', 'name description')
      .populate('invitedUser', 'displayName profileImage spotifyId')
      .populate('invitedBy', 'displayName profileImage spotifyId');

    return populatedInvite;
  }

  /**
   * Accept an invite
   * @param {string} inviteId - Invite ID
   * @param {string} userId - User ID accepting the invite
   * @returns {Promise<Object>} Updated group with populated fields
   * @throws {Error} If invite not found, invalid, or already processed
   */
  static async acceptInvite(inviteId, userId) {
    // Find invite
    const invite = await Invite.findById(inviteId)
      .populate('group');

    if (!invite) {
      const error = new Error('Invite not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify invite is for the current user
    if (invite.invitedUser.toString() !== userId.toString()) {
      const error = new Error('You are not authorized to accept this invite');
      error.statusCode = 403;
      throw error;
    }

    // Verify status is pending
    if (invite.status !== 'pending') {
      const error = new Error(`Invite has already been ${invite.status}`);
      error.statusCode = 400;
      throw error;
    }

    // Verify group is still active
    if (!invite.group.isActive) {
      const error = new Error('Group is no longer active');
      error.statusCode = 400;
      throw error;
    }

    // Update invite status
    invite.status = 'accepted';
    await invite.save();

    // Add user to group members if not already member
    const group = invite.group;
    if (!group.members.includes(userId)) {
      group.members.push(userId);
      await group.save();
    }

    // Add group to user's groups array if not already present
    const user = await User.findById(userId);
    if (user && !user.groups.includes(group._id)) {
      user.groups.push(group._id);
      await user.save();
    }

    // Return populated group
    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'displayName profileImage spotifyId')
      .populate('members', 'displayName profileImage spotifyId');

    return populatedGroup;
  }

  /**
   * Decline an invite
   * @param {string} inviteId - Invite ID
   * @param {string} userId - User ID declining the invite
   * @returns {Promise<Object>} Updated invite with populated fields
   * @throws {Error} If invite not found, invalid, or already processed
   */
  static async declineInvite(inviteId, userId) {
    // Find invite
    const invite = await Invite.findById(inviteId);

    if (!invite) {
      const error = new Error('Invite not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify invite is for the current user
    if (invite.invitedUser.toString() !== userId.toString()) {
      const error = new Error('You are not authorized to decline this invite');
      error.statusCode = 403;
      throw error;
    }

    // Verify status is pending
    if (invite.status !== 'pending') {
      const error = new Error(`Invite has already been ${invite.status}`);
      error.statusCode = 400;
      throw error;
    }

    // Update invite status
    invite.status = 'declined';
    await invite.save();

    // Populate and return
    const populatedInvite = await Invite.findById(invite._id)
      .populate('group', 'name description')
      .populate('invitedUser', 'displayName profileImage spotifyId')
      .populate('invitedBy', 'displayName profileImage spotifyId');

    return populatedInvite;
  }

  /**
   * List all invites for a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID requesting the list
   * @returns {Promise<Array>} Array of invites with populated fields
   * @throws {Error} If group not found or user is not authorized
   */
  static async listInvites(groupId, userId) {
    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      const error = new Error('Group not found or inactive');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is group owner or member
    const isOwner = group.createdBy.toString() === userId.toString();
    const isMember = group.members.includes(userId);

    if (!isOwner && !isMember) {
      const error = new Error('You must be a member of the group to view invites');
      error.statusCode = 403;
      throw error;
    }

    // Get all invites for the group
    const invites = await Invite.find({ group: groupId })
      .populate('invitedUser', 'displayName profileImage spotifyId')
      .populate('invitedBy', 'displayName profileImage spotifyId')
      .sort({ createdAt: -1 });

    return invites;
  }

  /**
   * Get all pending invites for a user (across all groups)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of pending invites with populated fields
   */
  static async getUserInvites(userId) {
    // Get all pending invites for the user
    const invites = await Invite.find({
      invitedUser: userId,
      status: 'pending'
    })
      .populate('group', 'name description inviteCode')
      .populate('invitedBy', 'displayName profileImage spotifyId')
      .sort({ createdAt: -1 });

    return invites;
  }
}

module.exports = InviteService;

