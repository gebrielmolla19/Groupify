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
   * Export group shares to a Spotify playlist
   * Creates a new playlist or adds tracks to existing one
   */
  static async exportGroupToPlaylist(req, res, next) {
    try {
      const { groupId } = req.params;
      const { playlistName, isPublic = false } = req.body;

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

      // Create playlist name
      const name = playlistName || `${group.name} - Groupify Playlist`;
      const description = `Collaborative playlist from Groupify group: ${group.name}. ${shares.length} tracks shared by group members.`;

      // Create playlist
      const playlist = await SpotifyService.createPlaylist(
        accessToken,
        spotifyProfile.id,
        name,
        description,
        isPublic
      );

      // Convert track IDs to URIs
      const trackUris = shares.map(share => `spotify:track:${share.spotifyTrackId}`);

      // Add tracks to playlist (handles chunking automatically)
      await SpotifyService.addTracksToPlaylist(accessToken, playlist.id, trackUris);

      res.json({
        success: true,
        message: 'Playlist created successfully',
        playlist: {
          id: playlist.id,
          name: playlist.name,
          external_urls: playlist.external_urls,
          tracks: {
            total: shares.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SpotifyController;

