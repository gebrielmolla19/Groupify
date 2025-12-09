const InviteService = require('../services/inviteService');

/**
 * Invite Controller
 * Handles HTTP requests for invite management
 * All business logic is delegated to InviteService
 */
class InviteController {
  /**
   * Create a new invite
   */
  static async createInvite(req, res, next) {
    try {
      const { groupId } = req.params;
      const { invitedUserSpotifyId } = req.body;
      const invitedByUserId = req.userId;

      const invite = await InviteService.createInvite(
        groupId,
        invitedUserSpotifyId,
        invitedByUserId
      );

      res.status(201).json({
        success: true,
        message: 'Invite created successfully',
        invite
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept an invite
   */
  static async acceptInvite(req, res, next) {
    try {
      const { groupId, inviteId } = req.params;
      const userId = req.userId;

      const group = await InviteService.acceptInvite(inviteId, userId);

      res.json({
        success: true,
        message: 'Invite accepted successfully',
        group
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Decline an invite
   */
  static async declineInvite(req, res, next) {
    try {
      const { groupId, inviteId } = req.params;
      const userId = req.userId;

      const invite = await InviteService.declineInvite(inviteId, userId);

      res.json({
        success: true,
        message: 'Invite declined successfully',
        invite
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all invites for a group
   */
  static async listInvites(req, res, next) {
    try {
      const { groupId } = req.params;
      const userId = req.userId;

      const invites = await InviteService.listInvites(groupId, userId);

      res.json({
        success: true,
        invites
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pending invites for the current user
   */
  static async getUserInvites(req, res, next) {
    try {
      const userId = req.userId;

      const invites = await InviteService.getUserInvites(userId);

      res.json({
        success: true,
        invites
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InviteController;

