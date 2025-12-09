const Share = require('../models/Share');
const Group = require('../models/Group');
const SpotifyService = require('./spotifyService');
const TokenManager = require('../utils/tokenManager');

/**
 * Share Service
 * Contains all business logic for song sharing and group feeds
 */
class ShareService {
  /**
   * Share a song to a group
   * @param {string} userId - User ID sharing the song
   * @param {string} groupId - Group ID to share to
   * @param {string} spotifyTrackId - Spotify track ID
   * @returns {Promise<Object>} Created share with populated fields
   * @throws {Error} If group not found or user is not a member
   */
  static async shareSong(userId, groupId, spotifyTrackId) {
    // Verify user is a member of the group
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

    // Get valid access token
    const accessToken = await TokenManager.getValidAccessToken(userId);

    // Get track details from Spotify
    const trackData = await SpotifyService.getTrackDetails(accessToken, spotifyTrackId);

    // Extract track information
    const trackInfo = {
      spotifyTrackId: trackData.id,
      trackName: trackData.name,
      artistName: trackData.artists.map(a => a.name).join(', '),
      albumName: trackData.album.name,
      trackImage: trackData.album.images?.[0]?.url || null,
      trackPreviewUrl: trackData.preview_url || null,
      trackExternalUrl: trackData.external_urls?.spotify || null,
      durationMs: trackData.duration_ms || 0
    };

    // Extract genres from album (if available)
    const genres = [];

    // Create share
    const share = new Share({
      group: groupId,
      sharedBy: userId,
      ...trackInfo,
      genres
    });

    await share.save();

    const populatedShare = await Share.findById(share._id)
      .populate('sharedBy', 'displayName profileImage spotifyId')
      .populate('group', 'name');

    return populatedShare;
  }

  /**
   * Get group feed (all shared songs for a group)
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID (to verify membership)
   * @param {number} limit - Number of shares to return
   * @param {number} offset - Number of shares to skip
   * @returns {Promise<Object>} Shares with pagination metadata
   * @throws {Error} If group not found or user is not a member
   */
  static async getGroupFeed(groupId, userId, limit = 50, offset = 0) {
    // Verify user is a member of the group
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

    // Get shares for the group
    const shares = await Share.find({ group: groupId })
      .populate('sharedBy', 'displayName profileImage spotifyId')
      .populate('listeners.user', 'displayName profileImage spotifyId')
      .populate('likes.user', 'displayName profileImage spotifyId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Share.countDocuments({ group: groupId });

    return {
      shares,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
  }

  /**
   * Mark a share as listened by user
   * @param {string} shareId - Share ID
   * @param {string} userId - User ID marking as listened
   * @returns {Promise<Object>} Updated share
   * @throws {Error} If share not found or user not in group
   */
  static async markAsListened(shareId, userId) {
    const share = await Share.findById(shareId)
      .populate('group', 'members');

    if (!share) {
      const error = new Error('Share not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is a member of the group
    if (!share.group.members.includes(userId)) {
      const error = new Error('You are not a member of this group');
      error.statusCode = 403;
      throw error;
    }

    // Check if user has already listened to this share
    const alreadyListened = share.listeners.some(
      listener => listener.user.toString() === userId.toString()
    );

    if (alreadyListened) {
      const error = new Error('You have already marked this song as listened');
      error.statusCode = 400;
      throw error;
    }

    // Calculate time to listen (from share creation to now)
    const timeToListen = Date.now() - share.createdAt.getTime();

    // Add listener
    share.listeners.push({
      user: userId,
      listenedAt: new Date(),
      timeToListen
    });

    // Increment listen count
    share.listenCount = share.listeners.length;

    await share.save();

    const populatedShare = await Share.findById(share._id)
      .populate('sharedBy', 'displayName profileImage spotifyId')
      .populate('listeners.user', 'displayName profileImage spotifyId')
      .populate('likes.user', 'displayName profileImage spotifyId')
      .populate('group', 'name');

    return populatedShare;
  }
  /**
   * Toggle like on a share
   * @param {string} shareId - Share ID
   * @param {string} userId - User ID toggling like
   * @returns {Promise<Object>} Updated share
   * @throws {Error} If share not found or user not in group
   */
  static async toggleLike(shareId, userId) {
    const share = await Share.findById(shareId)
      .populate('group', 'members');

    if (!share) {
      const error = new Error('Share not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is a member of the group
    if (!share.group.members.includes(userId)) {
      const error = new Error('You are not a member of this group');
      error.statusCode = 403;
      throw error;
    }

    // Check if user has already liked this share
    const likeIndex = share.likes.findIndex(
      like => like.user.toString() === userId.toString()
    );

    if (likeIndex > -1) {
      // Unlike
      share.likes.splice(likeIndex, 1);
    } else {
      // Like
      share.likes.push({
        user: userId,
        likedAt: new Date()
      });
    }

    // Update like count
    share.likeCount = share.likes.length;

    await share.save();

    const populatedShare = await Share.findById(share._id)
      .populate('sharedBy', 'displayName profileImage spotifyId')
      .populate('listeners.user', 'displayName profileImage spotifyId')
      .populate('likes.user', 'displayName profileImage spotifyId')
      .populate('group', 'name');

    return populatedShare;
  }
}

module.exports = ShareService;

