const ShareService = require('../services/shareService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Share Controller
 * Handles HTTP requests for song sharing and group feeds
 * All business logic is delegated to ShareService
 */
class ShareController {
  /**
   * Share a song to a group
   */
  static async shareSong(req, res, next) {
    try {
      const { groupId, spotifyTrackId } = req.body;
      const share = await ShareService.shareSong(req.userId, groupId, spotifyTrackId);

      // Emit socket event for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(groupId.toString()).emit('songShared', { share });

        // Fan-out notifications to other group members
        notificationService.createNotificationsForGroup(io, 'song_shared', req.userId, groupId, {
          trackName: share.trackName,
          artistName: share.artistName,
          groupName: share.group?.name || '',
        });
      }

      logger.info('[Share] Song shared to group', {
        userId: req.userId,
        userDisplayName: share.sharedBy?.displayName,
        groupId,
        groupName: share.group?.name,
        spotifyTrackId,
        trackName: share.trackName,
        artistName: share.artistName,
        shareId: share._id?.toString()
      });

      res.status(201).json({
        success: true,
        message: 'Song shared successfully',
        share
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group feed (all shared songs for a group)
   */
  static async getGroupFeed(req, res, next) {
    try {
      const { groupId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await ShareService.getGroupFeed(
        groupId,
        req.userId,
        limit,
        offset
      );

      logger.debug('[Share] Group feed fetched', {
        userId: req.userId,
        groupId,
        limit,
        offset,
        count: result.shares?.length ?? 0
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
   * Mark a share as listened
   */
  static async markAsListened(req, res, next) {
    try {
      const { shareId } = req.params;
      const share = await ShareService.markAsListened(shareId, req.userId);

      // Emit socket event for real-time updates
      if (req.app.get('io') && share.group) {
        req.app.get('io').to(share.group._id.toString()).emit('songListened', {
          shareId: share._id,
          userId: req.userId,
          listenCount: share.listenCount
        });
      }

      logger.info('[Share] Share marked as listened', {
        userId: req.userId,
        shareId,
        trackName: share.trackName,
        groupName: share.group?.name,
        listenCount: share.listenCount
      });

      res.json({
        success: true,
        message: 'Marked as listened',
        share
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unmark a share as listened
   */
  static async unmarkAsListened(req, res, next) {
    try {
      const { shareId } = req.params;
      const share = await ShareService.unmarkAsListened(shareId, req.userId);

      // Emit socket event for real-time updates
      if (req.app.get('io') && share.group) {
        req.app.get('io').to(share.group._id.toString()).emit('songUnlistened', {
          shareId: share._id,
          userId: req.userId,
          listenCount: share.listenCount
        });
      }

      logger.info('[Share] Share unmarked as listened', {
        userId: req.userId,
        shareId,
        trackName: share.trackName,
        groupName: share.group?.name,
        listenCount: share.listenCount
      });

      res.json({
        success: true,
        message: 'Unmarked as listened',
        share
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle like on a share
   */
  static async toggleLike(req, res, next) {
    try {
      const { shareId } = req.params;
      const share = await ShareService.toggleLike(shareId, req.userId);

      // Emit socket event for real-time updates
      if (req.app.get('io') && share.group) {
        req.app.get('io').to(share.group._id.toString()).emit('songLiked', {
          shareId: share._id,
          userId: req.userId,
          likeCount: share.likeCount,
          likes: share.likes
        });
      }

      const liked = share.likes?.map(String).includes(String(req.userId));
      logger.info('[Share] Like toggled on share', {
        userId: req.userId,
        shareId,
        trackName: share.trackName,
        groupName: share.group?.name,
        liked,
        likeCount: share.likeCount
      });

      res.json({
        success: true,
        message: 'Like toggled successfully',
        share
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a share from a group
   */
  static async removeShare(req, res, next) {
    try {
      const { shareId } = req.params;

      const result = await ShareService.removeShare(shareId, req.userId);

      // Emit socket event for real-time updates
      if (req.app.get('io') && result.groupId) {
        req.app.get('io').to(result.groupId.toString()).emit('songRemoved', {
          shareId,
          groupId: result.groupId
        });
      }

      logger.info('[Share] Share removed from group', {
        userId: req.userId,
        shareId,
        groupId: result.groupId?.toString(),
        groupName: result.groupName,
        trackName: result.trackName
      });

      res.json({
        success: true,
        message: 'Song removed from group'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ShareController;
