const UserService = require('../services/userService');

/**
 * User Controller
 * Handles HTTP requests for user profile and statistics
 * All business logic is delegated to UserService
 */
class UserController {
  /**
   * Get user statistics
   */
  static async getUserStats(req, res, next) {
    try {
      const stats = await UserService.getUserStats(req.userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(req, res, next) {
    try {
      const { displayName } = req.body;
      const updatedUser = await UserService.updateUserProfile(req.userId, displayName);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
