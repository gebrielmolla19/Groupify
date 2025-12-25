const axios = require('axios');
const SpotifyService = require('../services/spotifyService');
const TokenManager = require('../utils/tokenManager');
const User = require('../models/User');
const Share = require('../models/Share');
const Group = require('../models/Group');

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

      // Get valid access token
      const accessToken = await TokenManager.getValidAccessToken(req.userId);

      // Search Spotify
      const results = await SpotifyService.searchTracks(accessToken, query, parseInt(limit));

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

      // Get valid access token
      const accessToken = await TokenManager.getValidAccessToken(req.userId);

      // Get recently played from Spotify
      const results = await SpotifyService.getRecentlyPlayed(
        accessToken, 
        parseInt(limit),
        after ? parseInt(after) : null
      );

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

      // Get user and valid access token
      const user = await User.findById(req.userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      const accessToken = await TokenManager.getValidAccessToken(req.userId);

      // Get user's Spotify profile to get user ID
      const spotifyProfile = await SpotifyService.getUserProfile(accessToken);

      // Convert track IDs to URIs
      const trackUris = shares.map(share => `spotify:track:${share.spotifyTrackId}`);

      let playlist;
      let isNewPlaylist = false;

      // Check if group already has a collaborative playlist
      if (group.spotifyPlaylistId) {
        // Check if current user is the playlist owner
        const isPlaylistOwner = group.spotifyPlaylistOwnerId && 
                                group.spotifyPlaylistOwnerId.toString() === req.userId.toString();
        
        if (!isPlaylistOwner) {
          // User is not the owner - they can't update via API
          // Get playlist info to return it
          try {
            const playlistResponse = await axios.get(
              `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              }
            );
            
            playlist = playlistResponse.data;
            
            return res.json({
              success: true,
              message: 'Only the playlist creator can update tracks via Groupify. However, you can add tracks directly in Spotify since this is a collaborative playlist.',
              isNewPlaylist: false,
              playlist: {
                id: playlist.id,
                name: playlist.name,
                external_urls: playlist.external_urls,
                tracks: {
                  total: playlist.tracks?.total || 0
                }
              },
              playlistId: playlist.id,
              playlistUrl: playlist.external_urls?.spotify || null,
              canModify: false
            });
          } catch (getError) {
            // If we can't view the playlist, return error
            const error = new Error('Unable to access playlist. You may need to follow it first.');
            error.statusCode = 403;
            throw error;
          }
        }
        
        // User is the owner - try to update
        try {
          // First verify playlist exists by trying to get it
          await SpotifyService.getPlaylistTracks(accessToken, group.spotifyPlaylistId);
          
          // Playlist exists, replace all tracks
          await SpotifyService.replacePlaylistTracks(accessToken, group.spotifyPlaylistId, trackUris);
          
          // Get updated playlist info
          const playlistResponse = await axios.get(
            `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );
          
          playlist = playlistResponse.data;
          isNewPlaylist = false;
        } catch (error) {
          // If playlist was deleted (404) or marked as deleted, create a new one
          if (error.response?.status === 404 || 
              error.statusCode === 404 || 
              error.isPlaylistDeleted ||
              error.message.includes('404') ||
              error.message.includes('not found') ||
              error.message.includes('deleted')) {
            
            console.log(`Playlist ${group.spotifyPlaylistId} was deleted on Spotify, creating a new one...`);
            
            // Clear the invalid playlist ID
            group.spotifyPlaylistId = null;
            group.spotifyPlaylistUrl = null;
            group.spotifyPlaylistOwnerId = null;
            await group.save();
            
            // Fall through to create new playlist
            playlist = null;
          } else if (error.response?.status === 403) {
            // Permission error - even though we checked ownership, something changed
            throw new Error('You no longer have permission to modify this playlist. It may have been transferred to another user.');
          } else if (error.response?.status >= 500 && error.response?.status < 600) {
            // Server errors (502, 503, 504) - don't treat as deleted if user is owner
            // Just throw the error so user can retry
            throw error;
          } else {
            // Re-throw other errors (401, etc.)
            throw error;
          }
        }
      }

      // Create new collaborative playlist if one doesn't exist
      if (!playlist) {
        const name = playlistName || `${group.name} - Groupify Collaborative Playlist`;
        const description = `Collaborative playlist from Groupify group: ${group.name}. ${shares.length} tracks shared by group members.`;

        console.log('Creating new collaborative playlist:', { name, userId: spotifyProfile.id });

        // Create collaborative playlist (collaborative: true, public: false)
        playlist = await SpotifyService.createPlaylist(
          accessToken,
          spotifyProfile.id,
          name,
          description,
          false, // public: false (required for collaborative)
          true   // collaborative: true
        );

        console.log('Playlist created:', { playlistId: playlist?.id, playlistName: playlist?.name });

        // Validate playlist was created
        if (!playlist || !playlist.id) {
          throw new Error('Failed to create playlist: No playlist ID returned from Spotify');
        }

        // Add tracks to playlist
        await SpotifyService.addTracksToPlaylist(accessToken, playlist.id, trackUris);

        // Save playlist ID, URL, and owner to group
        group.spotifyPlaylistId = playlist.id;
        group.spotifyPlaylistUrl = playlist.external_urls?.spotify || null;
        group.spotifyPlaylistOwnerId = req.userId;
        await group.save();

        isNewPlaylist = true;
      }

      // Invite all group members to collaborate on the playlist
      // This is done by having each member follow the collaborative playlist
      let invitedCount = 0;
      let failedCount = 0;
      const inviteResults = [];

      if (isNewPlaylist) {
        // Only invite on new playlist creation
        try {
          if (group.members && group.members.length > 0) {
            // Invite all members (including the creator) to follow the playlist
            const invitePromises = group.members.map(async (member) => {
              try {
                // Get member ID (handle both ObjectId and populated document)
                const memberId = member._id ? member._id.toString() : member.toString();
                
                // Get valid access token for this member
                const memberAccessToken = await TokenManager.getValidAccessToken(memberId);
                
                // Have them follow the playlist (this enables collaboration)
                await SpotifyService.followPlaylist(memberAccessToken, playlist.id);
                
                invitedCount++;
                inviteResults.push({
                  userId: memberId,
                  displayName: member.displayName || 'Unknown',
                  success: true
                });
              } catch (error) {
                // Log but don't fail the whole operation if one user fails
                const memberId = member._id ? member._id.toString() : member.toString();
                failedCount++;
                inviteResults.push({
                  userId: memberId,
                  displayName: member.displayName || 'Unknown',
                  success: false,
                  error: error.message
                });
                console.error(`Failed to invite user ${member.displayName || memberId} to playlist:`, error.message);
              }
            });

            // Wait for all invites to complete (don't fail if some fail)
            await Promise.allSettled(invitePromises);
          }
        } catch (error) {
          // Log but don't fail the whole operation if inviting fails
          console.error('Error inviting group members to playlist:', error.message);
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
          tracks: {
            total: shares.length
          }
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

      // Verify user is a member of the group
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

      // Get user's valid access token
      const accessToken = await TokenManager.getValidAccessToken(req.userId);

      // Follow the playlist
      await SpotifyService.followPlaylist(accessToken, group.spotifyPlaylistId);

      // Get playlist info
      const playlistResponse = await axios.get(
        `https://api.spotify.com/v1/playlists/${group.spotifyPlaylistId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const playlist = playlistResponse.data;

      res.json({
        success: true,
        message: 'Successfully followed the collaborative playlist!',
        playlist: {
          id: playlist.id,
          name: playlist.name,
          external_urls: playlist.external_urls,
          tracks: {
            total: playlist.tracks?.total || 0
          }
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

