const GroupService = require('../services/groupService');
const logger = require('../utils/logger');

/**
 * Group Controller
 * Handles HTTP requests for group management
 * All business logic is delegated to GroupService
 */
class GroupController {
  /**
   * Create a new group
   */
  static async createGroup(req, res, next) {
    try {
      const { name, description } = req.body;
      const group = await GroupService.createGroup(req.userId, name, description);

      logger.info('[Group] Group created', {
        userId: req.userId,
        groupId: group._id?.toString(),
        groupName: group.name
      });

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        group
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all groups for the current user
   */
  static async getUserGroups(req, res, next) {
    try {
      const groups = await GroupService.getUserGroups(req.userId);

      logger.debug('[Group] User groups fetched', {
        userId: req.userId,
        count: groups?.length ?? 0
      });

      res.json({
        success: true,
        groups
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group details by ID
   */
  static async getGroupById(req, res, next) {
    try {
      const { id } = req.params;
      const group = await GroupService.getGroupById(id, req.userId);

      logger.debug('[Group] Group details fetched', {
        userId: req.userId,
        groupId: id
      });

      res.json({
        success: true,
        group
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join a group using invite code only (no groupId in URL)
   */
  static async joinGroupByCode(req, res, next) {
    try {
      const { inviteCode } = req.body;
      const group = await GroupService.joinGroup(req.userId, inviteCode);

      logger.info('[Group] User joined group via invite code', {
        userId: req.userId,
        groupId: group._id?.toString(),
        groupName: group.name
      });

      res.json({
        success: true,
        message: 'Successfully joined group',
        group
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join a group using invite code (with groupId in URL - for backward compatibility)
   */
  static async joinGroup(req, res, next) {
    try {
      const { inviteCode } = req.body;
      const group = await GroupService.joinGroup(req.userId, inviteCode);

      logger.info('[Group] User joined group', {
        userId: req.userId,
        groupId: group._id?.toString(),
        groupName: group.name
      });

      res.json({
        success: true,
        message: 'Successfully joined group',
        group
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a group
   */
  static async leaveGroup(req, res, next) {
    try {
      const { id } = req.params;
      const result = await GroupService.leaveGroup(id, req.userId);

      logger.info('[Group] User left group', {
        userId: req.userId,
        groupId: id
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group settings
   */
  static async getGroupSettings(req, res, next) {
    try {
      const { groupId } = req.params;
      const settings = await GroupService.getGroupSettings(groupId, req.userId);

      logger.debug('[Group] Group settings fetched', {
        userId: req.userId,
        groupId
      });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update group settings
   */
  static async updateGroupSettings(req, res, next) {
    try {
      const { groupId } = req.params;
      const { name, description } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;

      const settings = await GroupService.updateGroupSettings(groupId, req.userId, updates);

      logger.info('[Group] Group settings updated', {
        userId: req.userId,
        groupId,
        updatedFields: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'Group settings updated successfully',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a member from a group
   */
  static async removeGroupMember(req, res, next) {
    try {
      const { groupId, memberId } = req.params;
      const result = await GroupService.removeGroupMember(groupId, req.userId, memberId);

      logger.info('[Group] Member removed from group', {
        requestedByUserId: req.userId,
        removedMemberId: memberId,
        groupId
      });

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a group (owner only)
   */
  static async deleteGroup(req, res, next) {
    try {
      const { id } = req.params;
      const result = await GroupService.deleteGroup(id, req.userId);

      logger.info('[Group] Group deleted', {
        userId: req.userId,
        groupId: result.groupId?.toString(),
        groupName: result.groupName
      });

      res.json({
        success: true,
        message: result.message,
        data: {
          groupId: result.groupId,
          groupName: result.groupName
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GroupController;
