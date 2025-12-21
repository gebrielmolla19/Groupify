const GroupService = require('../services/groupService');

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

