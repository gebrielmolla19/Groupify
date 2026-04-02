const User = require('../models/User');
const Group = require('../models/Group');
const Share = require('../models/Share');

/**
 * User Service
 * Contains all business logic for user operations
 */
class UserService {
  /**
   * Get user statistics
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<Object>} User statistics
   */
  static async getUserStats(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Count groups the user is a member of
    const groupsJoined = await Group.countDocuments({
      members: userId,
      isActive: true
    });

    // Count tracks shared by the user
    const tracksShared = await Share.countDocuments({
      sharedBy: userId
    });

    // Count total listens on user's shared tracks
    const shareAggregation = await Share.aggregate([
      { $match: { sharedBy: userId } },
      { $group: { _id: null, totalListens: { $sum: '$listenCount' } } }
    ]);

    const totalListens = shareAggregation.length > 0 ? shareAggregation[0].totalListens : 0;

    return {
      tracksShared,
      groupsJoined,
      totalListens
    };
  }

  /**
   * Update user profile
   * @param {string} userId - User MongoDB ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.displayName] - New display name
   * @param {Object} [updates.notificationPreferences] - Notification preferences
   * @returns {Promise<Object>} Updated user object
   */
  static async updateUserProfile(userId, updates) {
    const updateFields = {};

    if (updates.displayName) {
      updateFields.displayName = updates.displayName.trim();
    }

    if (updates.notificationPreferences) {
      for (const [key, value] of Object.entries(updates.notificationPreferences)) {
        updateFields[`notificationPreferences.${key}`] = value;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-spotifyAccessToken -spotifyRefreshToken');

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }
}

module.exports = UserService;
