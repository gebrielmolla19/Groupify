const axios = require('axios');
const SpotifyService = require('../services/spotifyService');
const TokenManager = require('../utils/tokenManager');
const User = require('../models/User');
const Share = require('../models/Share');
const Group = require('../models/Group');
const logger = require('../utils/logger');

/**
 * Spotify Controller
 * Handles HTTP requests for Spotify API interactions
 */
class SpotifyController {
  /**
   * Search for tracks on Spotify
   */
  static async searchTracks(req, res, next) {
    try {
      const { q: query, limit = 20 } = req.query;

      if (!query || query.trim().length === 0) {
        const error = new Error('Search query is required');
        error.statusCode = 400;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(req.userId);
      const results = await SpotifyService.searchTracks(accessToken, query, parseInt(limit));

      logger.debug('[Spotify] Track search performed', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        query,
        limit: parseInt(limit),
        resultsTotal: results.tracks?.total
      });

      res.json({
        success: true,
        tracks: results.tracks.items,
        total: results.tracks.total,
        limit: parseInt(limit)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's recently played tracks
   */
  static async getRecentlyPlayed(req, res, next) {
    try {
      const { limit = 20, after } = req.query;

      const accessToken = await TokenManager.getValidAccessToken(req.userId);
      const results = await SpotifyService.getRecentlyPlayed(
        accessToken,
        parseInt(limit),
        after ? parseInt(after) : null
      );

      logger.debug('[Spotify] Recently played tracks fetched', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        limit: parseInt(limit),
        count: results.items?.length
      });

      res.json({
        success: true,
        items: results.items,
        next: results.next,
        cursors: results.cursors,
        limit: parseInt(limit)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export group shares to a Spotify collaborative playlist
   * Creates a new collaborative playlist or updates existing one
   */
  static async exportGroupToPlaylist(req, res, next) {
    try {
      const { groupId } = req.params;
      const { playlistName } = req.body;

      // Verify user is a member of the group and populate members
      const group = await Group.findOne({
        _id: groupId,
        members: req.userId,
        isActive: true
      }).populate('members', 'spotifyId displayName');

      if (!group) {
        const error = new Error('Group not found or you are not a member');
        error.statusCode = 404;
        throw error;
      }

      // Get all shares for the group
      const shares = await Share.find({ group: groupId }).sort({ createdAt: -1 });

      if (shares.length === 0) {
        const error = new Error('No tracks to export');
        error.statusCode = 400;
        throw error;
      }

      const user = await User.findById(req.userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(req.userId);
      const spotifyProfile = await SpotifyService.getUserProfile(accessToken);
      const trackUris = shares.map(share => `spotify:track:${share.spotifyTrackId}`);

      let playlist;
      let isNewPlaylist = false;

      if (group.spotifyPlaylistId) {
        const isPlaylistOwner = group.spotifyPlaylistOwnerId &&
                                group.spotifyPlaylistOwnerId.toString() === req.userId.toString();

        if (!isPlaylistOwner) {
          try {
            const playlistResponse = await axios.get(
              `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            playlist = playlistResponse.data;

            logger.info('[Spotify] Non-owner requested playlist export — returning existing playlist', {
              userId: req.userId,
              userDisplayName: req.user?.displayName,
              groupId,
              groupName: group.name,
              playlistId: playlist.id
            });

            return res.json({
              success: true,
              message: 'Only the playlist creator can update tracks via Groupify. However, you can add tracks directly in Spotify since this is a collaborative playlist.',
              isNewPlaylist: false,
              playlist: {
                id: playlist.id,
                name: playlist.name,
                external_urls: playlist.external_urls,
                tracks: { total: playlist.tracks?.total || 0 }
              },
              playlistId: playlist.id,
              playlistUrl: playlist.external_urls?.spotify || null,
              canModify: false
            });
          } catch (getError) {
            const error = new Error('Unable to access playlist. You may need to follow it first.');
            error.statusCode = 403;
            throw error;
          }
        }

        // User is the owner — try to update
        try {
          await SpotifyService.getPlaylistTracks(accessToken, group.spotifyPlaylistId);
          await SpotifyService.replacePlaylistTracks(accessToken, group.spotifyPlaylistId, trackUris);

          const playlistResponse = await axios.get(
            `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          playlist = playlistResponse.data;
          isNewPlaylist = false;

          logger.info('[Spotify] Existing collaborative playlist updated', {
            userId: req.userId,
            userDisplayName: req.user?.displayName,
            groupId,
            groupName: group.name,
            playlistId: playlist.id,
            trackCount: shares.length
          });
        } catch (error) {
          if (error.response?.status === 404 ||
              error.statusCode === 404 ||
              error.isPlaylistDeleted ||
              error.message.includes('404') ||
              error.message.includes('not found') ||
              error.message.includes('deleted')) {

            logger.warn('[Spotify] Existing playlist not found on Spotify — will create a new one', {
              userId: req.userId,
              userDisplayName: req.user?.displayName,
              groupId,
              groupName: group.name,
              oldPlaylistId: group.spotifyPlaylistId
            });

            group.spotifyPlaylistId = null;
            group.spotifyPlaylistUrl = null;
            group.spotifyPlaylistOwnerId = null;
            await group.save();

            playlist = null;
          } else if (error.response?.status === 403) {
            throw new Error('You no longer have permission to modify this playlist. It may have been transferred to another user.');
          } else if (error.response?.status >= 500 && error.response?.status < 600) {
            throw error;
          } else {
            throw error;
          }
        }
      }

      // Create new collaborative playlist if one doesn't exist
      if (!playlist) {
        const name = playlistName || `${group.name} - Groupify Collaborative Playlist`;
        const description = `Collaborative playlist from Groupify group: ${group.name}. ${shares.length} tracks shared by group members.`;

        logger.info('[Spotify] Creating new collaborative playlist', {
          userId: req.userId,
          userDisplayName: req.user?.displayName,
          groupId,
          groupName: group.name,
          playlistName: name,
          trackCount: shares.length
        });

        playlist = await SpotifyService.createPlaylist(
          accessToken,
          spotifyProfile.id,
          name,
          description,
          false, // public: false (required for collaborative)
          true   // collaborative: true
        );

        if (!playlist || !playlist.id) {
          throw new Error('Failed to create playlist: No playlist ID returned from Spotify');
        }

        await SpotifyService.addTracksToPlaylist(accessToken, playlist.id, trackUris);

        group.spotifyPlaylistId = playlist.id;
        group.spotifyPlaylistUrl = playlist.external_urls?.spotify || null;
        group.spotifyPlaylistOwnerId = req.userId;
        await group.save();

        isNewPlaylist = true;

        logger.info('[Spotify] Collaborative playlist created', {
          userId: req.userId,
          userDisplayName: req.user?.displayName,
          groupId,
          groupName: group.name,
          playlistId: playlist.id,
          playlistName: playlist.name
        });
      }

      // Invite all group members to collaborate on the playlist
      let invitedCount = 0;
      let failedCount = 0;
      const inviteResults = [];

      if (isNewPlaylist) {
        try {
          if (group.members && group.members.length > 0) {
            const invitePromises = group.members.map(async (member) => {
              try {
                const memberId = member._id ? member._id.toString() : member.toString();
                const memberAccessToken = await TokenManager.getValidAccessToken(memberId);
                await SpotifyService.followPlaylist(memberAccessToken, playlist.id);

                invitedCount++;
                inviteResults.push({
                  userId: memberId,
                  displayName: member.displayName || 'Unknown',
                  success: true
                });
              } catch (error) {
                const memberId = member._id ? member._id.toString() : member.toString();
                failedCount++;
                inviteResults.push({
                  userId: memberId,
                  displayName: member.displayName || 'Unknown',
                  success: false,
                  error: error.message
                });
                logger.warn('[Spotify] Failed to invite member to collaborative playlist', {
                  memberId,
                  displayName: member.displayName,
                  playlistId: playlist.id,
                  error: error.message
                });
              }
            });

            await Promise.allSettled(invitePromises);

            logger.info('[Spotify] Collaborative playlist member invitations complete', {
              userId: req.userId,
              userDisplayName: req.user?.displayName,
              groupName: group.name,
              playlistId: playlist.id,
              invited: invitedCount,
              failed: failedCount
            });
          }
        } catch (error) {
          logger.error('[Spotify] Error during group member playlist invitations', {
            userId: req.userId,
            userDisplayName: req.user?.displayName,
            groupName: group.name,
            playlistId: playlist.id,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: isNewPlaylist
          ? `Collaborative playlist created successfully${invitedCount > 0 ? ` and ${invitedCount} member${invitedCount > 1 ? 's' : ''} invited` : ''}`
          : 'Playlist updated successfully',
        isNewPlaylist,
        playlist: {
          id: playlist.id,
          name: playlist.name,
          external_urls: playlist.external_urls,
          tracks: { total: shares.length }
        },
        playlistId: playlist.id,
        playlistUrl: playlist.external_urls?.spotify || null,
        canModify: true,
        invites: {
          invited: invitedCount,
          failed: failedCount,
          results: inviteResults
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Follow a collaborative playlist (for non-owners)
   */
  static async followGroupPlaylist(req, res, next) {
    try {
      const { groupId } = req.params;

      const group = await Group.findOne({
        _id: groupId,
        members: req.userId,
        isActive: true
      });

      if (!group) {
        const error = new Error('Group not found or you are not a member');
        error.statusCode = 404;
        throw error;
      }

      if (!group.spotifyPlaylistId) {
        const error = new Error('No playlist exists for this group yet');
        error.statusCode = 404;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(req.userId);
      await SpotifyService.followPlaylist(accessToken, group.spotifyPlaylistId);

      const playlistResponse = await axios.get(
        `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const playlist = playlistResponse.data;

      logger.info('[Spotify] User followed collaborative playlist', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId,
        groupName: group.name,
        playlistId: playlist.id,
        playlistName: playlist.name
      });

      res.json({
        success: true,
        message: 'Successfully followed the collaborative playlist!',
        playlist: {
          id: playlist.id,
          name: playlist.name,
          external_urls: playlist.external_urls,
          tracks: { total: playlist.tracks?.total || 0 }
        },
        playlistId: playlist.id,
        playlistUrl: playlist.external_urls?.spotify || null
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SpotifyController;
