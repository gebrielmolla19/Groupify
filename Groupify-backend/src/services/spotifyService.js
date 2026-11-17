const axios = require('axios');
const logger = require('../utils/logger');
const { createSpotifyReauthError } = require('../utils/spotifyReauth');

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SEARCH_LIMIT_MAX = 10;
// GET /playlists/{id}/items returns at most 50 per page.
const PLAYLIST_ITEMS_PAGE_SIZE = 50;
// POST and PUT /playlists/{id}/items take at most 100 URIs per request.
const PLAYLIST_ITEMS_WRITE_MAX = 100;

/**
 * Spotify API Service
 * Handles all interactions with the Spotify Web API
 */
class SpotifyService {
  /**
   * Get user profile information
   * @param {string} accessToken - Spotify access token
   * @returns {Promise<Object>} User profile data
   */
  static async getUserProfile(accessToken) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      // Handle specific Spotify API errors
      if (error.response) {
        const status = error.response.status;
        const responseData = error.response.data;
        
        // Extract Spotify error message from various possible response structures
        let spotifyMessage = error.message;
        let spotifyErrorDetails = null;
        
        if (responseData) {
          // Try different possible error response structures
          if (typeof responseData === 'string') {
            // Spotify sometimes returns plain string error messages
            spotifyMessage = responseData;
            spotifyErrorDetails = responseData;
          } else if (responseData.error) {
            if (typeof responseData.error === 'string') {
              spotifyMessage = responseData.error;
              spotifyErrorDetails = responseData;
            } else if (responseData.error.message) {
              spotifyMessage = responseData.error.message;
              spotifyErrorDetails = responseData.error;
            } else {
              spotifyErrorDetails = responseData.error;
            }
          } else if (responseData.message) {
            spotifyMessage = responseData.message;
            spotifyErrorDetails = responseData;
          } else {
            // Log the full response for debugging
            logger.error('[Spotify API] Full error response:', JSON.stringify(responseData, null, 2));
            spotifyErrorDetails = responseData;
          }
        }
        
        // Log detailed error information for debugging
        logger.error('[Spotify API] Error details:', {
          status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: responseData,
          spotifyMessage,
          url: `${SPOTIFY_API_BASE}/me`
        });
        
        // Create error with statusCode so controller can return proper HTTP status
        const customError = new Error();
        
        if (status === 401) {
          customError.message = `Invalid or expired Spotify access token: ${spotifyMessage}`;
          customError.statusCode = 401;
          customError.spotifyError = spotifyMessage;
          customError.spotifyErrorDetails = spotifyErrorDetails;
          throw customError;
        } else if (status === 403) {
          // 403 can mean insufficient scopes, token belongs to different app, account restrictions, or user not registered
          let errorMessage = spotifyMessage || 'Insufficient permissions or invalid token.';
          
          // Check for specific Spotify error messages
          if (spotifyMessage && spotifyMessage.includes('user may not be registered')) {
            errorMessage = 'User not registered as a test user. Your Spotify app is in Development Mode. Please add this user as a test user in your Spotify Developer Dashboard, or switch to Extended Quota Mode.';
            customError.isUserNotRegistered = true;
          } else if (spotifyMessage && spotifyMessage.includes('developer.spotify.com/dashboard')) {
            errorMessage = `Spotify API access denied: ${spotifyMessage}`;
            customError.isUserNotRegistered = true;
          } else {
            errorMessage = `Spotify API access denied: ${spotifyMessage || 'Insufficient permissions or invalid token. This may occur if: 1) The token was issued for a different Spotify app, 2) Required scopes were not granted, 3) The account has restrictions. Please ensure you granted all required permissions during login and that you\'re using the correct Spotify app credentials.'}`;
          }
          
          customError.message = errorMessage;
          customError.statusCode = 403;
          customError.spotifyError = spotifyMessage;
          customError.spotifyErrorDetails = spotifyErrorDetails;
          customError.details = {
            status,
            statusText: error.response.statusText,
            spotifyError: spotifyErrorDetails,
            requiredScopes: ['user-read-email', 'user-read-private'],
            possibleCauses: [
              'User not registered as a test user (app in Development Mode)',
              'Token was issued for a different Spotify app (check SPOTIFY_CLIENT_ID)',
              'Insufficient scopes granted during OAuth',
              'Redirect URI mismatch',
              'Account restrictions or limitations'
            ]
          };
          throw customError;
        } else if (status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          customError.message = `Spotify API rate limit exceeded${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`;
          customError.statusCode = 429;
          customError.retryAfter = retryAfter;
          throw customError;
        } else {
          customError.message = `Failed to fetch user profile: ${spotifyMessage}`;
          customError.statusCode = status || 500;
          customError.spotifyError = spotifyMessage;
          customError.spotifyErrorDetails = spotifyErrorDetails;
          throw customError;
        }
      }
      
      // Network or other errors
      logger.error('[Spotify API] Network error:', {
        message: error.message,
        code: error.code,
        url: `${SPOTIFY_API_BASE}/me`
      });
      
      const networkError = new Error(`Failed to fetch user profile: ${error.message}`);
      networkError.statusCode = 500;
      throw networkError;
    }
  }

  /**
   * Get user's recently played tracks
   * @param {string} accessToken - Spotify access token
   * @param {number} limit - Number of tracks to fetch (max 50)
   * @param {number} after - Unix timestamp in milliseconds to return tracks after
   * @returns {Promise<Object>} Recently played tracks
   */
  static async getRecentlyPlayed(accessToken, limit = 50, after = null) {
    try {
      const params = { limit };
      if (after) {
        params.after = after;
      }

      const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/recently-played`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch recently played tracks: ${error.message}`);
    }
  }

  /**
   * Search for tracks
   * @param {string} accessToken - Spotify access token
   * @param {string} query - Search query
   * @param {number} limit - Number of results. Spotify caps this at 10 for
   *   development-mode apps since February 2026 (research/spotify.md §4a).
   * @returns {Promise<Object>} Search results
   */
  static async searchTracks(accessToken, query, limit = SEARCH_LIMIT_MAX) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          q: query,
          type: 'track',
          limit: Math.min(Math.max(limit || SEARCH_LIMIT_MAX, 1), SEARCH_LIMIT_MAX)
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search tracks: ${error.message}`);
    }
  }

  /**
   * Get track details by ID
   * @param {string} accessToken - Spotify access token
   * @param {string} trackId - Spotify track ID
   * @returns {Promise<Object>} Track details
   */
  static async getTrackDetails(accessToken, trackId) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch track details: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @param {{ clientId: string, clientSecret: string }} [credentials] - Optional app credentials (for multi-app workaround)
   * @returns {Promise<Object>} Token data with access_token and refresh_token
   */
  static async exchangeCodeForToken(code, credentials = null) {
    try {
      const clientId = credentials?.clientId || process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = credentials?.clientSecret || process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Spotify client credentials not configured');
      }

      if (!process.env.SPOTIFY_REDIRECT_URI) {
        throw new Error('Spotify redirect URI not configured');
      }

      const authCredentials = Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64');

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI
        }),
        {
          headers: {
            'Authorization': `Basic ${authCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Validate response
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response from Spotify');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        scope: response.data.scope
      };
    } catch (error) {
      // Handle specific Spotify API errors
      if (error.response) {
        const status = error.response.status;
        const spotifyError = error.response.data?.error;
        const spotifyMessage = spotifyError?.message || error.message;
        
        const customError = new Error();
        
        if (status === 400) {
          // Bad request - usually invalid code or redirect_uri mismatch
          customError.message = `Invalid authorization code or redirect URI mismatch: ${spotifyMessage || 'Please try logging in again'}`;
          customError.statusCode = 400;
          customError.spotifyError = spotifyMessage;
          throw customError;
        } else if (status === 401) {
          // Invalid client credentials
          customError.message = 'Invalid Spotify client credentials. Please check your environment variables.';
          customError.statusCode = 401;
          customError.spotifyError = spotifyMessage;
          throw customError;
        } else {
          customError.message = `Failed to exchange code for token: ${spotifyMessage}`;
          customError.statusCode = status || 500;
          customError.spotifyError = spotifyMessage;
          throw customError;
        }
      }
      
      // Re-throw validation errors as-is
      if (error.message.includes('not configured') || error.message.includes('Invalid token response')) {
        throw error;
      }
      
      // Network or other errors
      const networkError = new Error(`Failed to exchange code for token: ${error.message}`);
      networkError.statusCode = 500;
      throw networkError;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Spotify refresh token
   * @param {{ clientId: string, clientSecret: string }} [credentials] - Optional app credentials (must match app that issued the refresh token)
   * @returns {Promise<Object>} New token data
   */
  static async refreshAccessToken(refreshToken, credentials = null) {
    try {
      const clientId = credentials?.clientId || process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = credentials?.clientSecret || process.env.SPOTIFY_CLIENT_SECRET;

      const authCredentials = Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64');

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${authCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token || refreshToken, // May not always return new refresh token
        scope: response.data.scope
      };
    } catch (error) {
      // Expired (six months after authorisation) or revoked refresh token.
      // Retrying can't help; the user must sign in with Spotify again.
      if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
        logger.warn('[SpotifyService] Refresh token rejected with invalid_grant', {
          description: error.response.data.error_description
        });
        throw createSpotifyReauthError();
      }
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Create a new playlist for the user
   * @param {string} accessToken - Spotify access token (the playlist is
   *   created on this user's account)
   * @param {string} name - Playlist name
   * @param {string} description - Playlist description
   * @param {boolean} isPublic - Whether playlist is public (default: false)
   * @param {boolean} collaborative - Whether playlist is collaborative (default: false)
   * @returns {Promise<Object>} Created playlist data
   */
  static async createPlaylist(accessToken, name, description = '', isPublic = false, collaborative = false, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptCreate = async (retryCount = 0) => {
      try {
        // If collaborative is true, public must be false (Spotify API requirement)
        const playlistData = {
          name,
          description,
          public: collaborative ? false : isPublic,
          collaborative: collaborative
        };

        const response = await axios.post(
          `${SPOTIFY_API_BASE}/me/playlists`,
          playlistData,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        return response.data;
      } catch (error) {
        // Handle specific Spotify API errors
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data;
          
          let spotifyMessage = error.message;
          if (responseData?.error?.message) {
            spotifyMessage = responseData.error.message;
          } else if (typeof responseData === 'string') {
            spotifyMessage = responseData;
          }
          
          // Retry on server errors (502, 503, 504) with exponential backoff
          if (status >= 500 && status < 600 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            logger.warn(`Spotify API server error (${status}) when creating playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptCreate(retryCount + 1);
          }
          
          const customError = new Error();
          
          if (status >= 500 && status < 600) {
            customError.message = `Spotify API is temporarily unavailable (${status}). Please try again in a moment.`;
            customError.statusCode = status;
            customError.spotifyError = spotifyMessage;
            customError.isServerError = true;
            customError.isRetryable = true;
            throw customError;
          } else if (status === 403) {
            customError.message = `Insufficient permissions to create playlist. Please ensure you have granted the 'playlist-modify-private' scope during login. Error: ${spotifyMessage}`;
            customError.statusCode = 403;
            customError.spotifyError = spotifyMessage;
            customError.details = {
              requiredScopes: ['playlist-modify-private'],
              suggestion: 'Please log out and log back in to grant the required permissions.'
            };
            throw customError;
          } else if (status === 401) {
            customError.message = `Invalid or expired Spotify access token: ${spotifyMessage}`;
            customError.statusCode = 401;
            customError.spotifyError = spotifyMessage;
            throw customError;
          } else if (status === 400) {
            customError.message = `Invalid playlist data: ${spotifyMessage}`;
            customError.statusCode = 400;
            customError.spotifyError = spotifyMessage;
            throw customError;
          } else {
            customError.message = `Failed to create playlist: ${spotifyMessage}`;
            customError.statusCode = status || 500;
            customError.spotifyError = spotifyMessage;
            throw customError;
          }
        }
        
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries && !error.response) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Network error when creating playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(delay);
          return attemptCreate(retryCount + 1);
        }
        
        // Network or other errors
        throw new Error(`Failed to create playlist: ${error.message}`);
      }
    };
    
    return attemptCreate();
  }

  /**
   * Add tracks to a playlist with retry logic for server errors
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Spotify playlist ID
   * @param {string[]} trackUris - Array of Spotify track URIs (spotify:track:xxx)
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<Object>} Snapshot ID of the playlist
   */
  static async addTracksToPlaylist(accessToken, playlistId, trackUris, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptAddTracks = async (retryCount = 0) => {
      try {
        const chunks = [];
        for (let i = 0; i < trackUris.length; i += PLAYLIST_ITEMS_WRITE_MAX) {
          chunks.push(trackUris.slice(i, i + PLAYLIST_ITEMS_WRITE_MAX));
        }

        const results = [];
        for (const chunk of chunks) {
          const response = await axios.post(
            `${SPOTIFY_API_BASE}/playlists/${playlistId}/items`,
            {
              uris: chunk
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          results.push(response.data);
        }

        return results[results.length - 1]; // Return last snapshot ID
      } catch (error) {
        // Handle specific Spotify API errors
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data;
          
          let spotifyMessage = error.message;
          if (responseData?.error?.message) {
            spotifyMessage = responseData.error.message;
          }
          
          // Retry on server errors (502, 503, 504) with exponential backoff
          if (status >= 500 && status < 600 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            logger.warn(`Spotify API server error (${status}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptAddTracks(retryCount + 1);
          }
          
          const customError = new Error();
          
          if (status >= 500 && status < 600) {
            customError.message = `Spotify API is temporarily unavailable (${status}). Please try again in a moment.`;
            customError.statusCode = status;
            customError.spotifyError = spotifyMessage;
            customError.isServerError = true;
            customError.isRetryable = true;
            throw customError;
          } else if (status === 404) {
            customError.message = `Playlist not found. It may have been deleted on Spotify.`;
            customError.statusCode = 404;
            customError.spotifyError = spotifyMessage;
            customError.isPlaylistDeleted = true;
            throw customError;
          } else if (status === 403) {
            customError.message = `Insufficient permissions to add tracks to playlist: ${spotifyMessage}`;
            customError.statusCode = 403;
            customError.spotifyError = spotifyMessage;
            throw customError;
          } else if (status === 401) {
            customError.message = `Invalid or expired Spotify access token: ${spotifyMessage}`;
            customError.statusCode = 401;
            customError.spotifyError = spotifyMessage;
            throw customError;
          }
        }
        
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries && !error.response) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(delay);
          return attemptAddTracks(retryCount + 1);
        }
        
        throw new Error(`Failed to add tracks to playlist: ${error.message}`);
      }
    };
    
    return attemptAddTracks();
  }

  /**
   * Replace all tracks in a playlist
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Spotify playlist ID
   * @param {string[]} trackUris - Array of Spotify track URIs (spotify:track:xxx)
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<Object>} Snapshot ID of the playlist
   * @throws {Error} If playlist doesn't exist (404) or other errors
   */
  static async replacePlaylistTracks(accessToken, playlistId, trackUris, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptReplace = async (retryCount = 0) => {
      try {
        // PUT replaces everything in the playlist with up to 100 items (an
        // empty list clears it); anything beyond that is appended after.
        const response = await axios.put(
          `${SPOTIFY_API_BASE}/playlists/${playlistId}/items`,
          { uris: trackUris.slice(0, PLAYLIST_ITEMS_WRITE_MAX) },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const rest = trackUris.slice(PLAYLIST_ITEMS_WRITE_MAX);
        if (rest.length > 0) {
          return await this.addTracksToPlaylist(accessToken, playlistId, rest, maxRetries);
        }

        return response.data;
      } catch (error) {
        // Handle specific Spotify API errors
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data;
          
          let spotifyMessage = error.message;
          if (responseData?.error?.message) {
            spotifyMessage = responseData.error.message;
          }
          
          // Retry on server errors (502, 503, 504) with exponential backoff
          if (status >= 500 && status < 600 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            logger.warn(`Spotify API server error (${status}) when replacing tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptReplace(retryCount + 1);
          }
          
          const customError = new Error();
          
          if (status === 404) {
            // Playlist was deleted or doesn't exist
            customError.message = `Playlist not found. It may have been deleted on Spotify.`;
            customError.statusCode = 404;
            customError.spotifyError = spotifyMessage;
            customError.isPlaylistDeleted = true;
            throw customError;
          } else if (status >= 500 && status < 600) {
            // Server errors (502, 503, 504, etc.) - Spotify API issues
            customError.message = `Spotify API is temporarily unavailable (${status}). Please try again in a moment.`;
            customError.statusCode = status;
            customError.spotifyError = spotifyMessage;
            customError.isServerError = true;
            customError.isRetryable = true;
            throw customError;
          } else if (status === 403) {
            customError.message = `Insufficient permissions to modify playlist: ${spotifyMessage}`;
            customError.statusCode = 403;
            customError.spotifyError = spotifyMessage;
            throw customError;
          } else if (status === 401) {
            customError.message = `Invalid or expired Spotify access token: ${spotifyMessage}`;
            customError.statusCode = 401;
            customError.spotifyError = spotifyMessage;
            throw customError;
          }
        }
        
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries && !error.response) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Network error when replacing tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(delay);
          return attemptReplace(retryCount + 1);
        }
        
        // Network errors or other issues
        const networkError = new Error(`Failed to replace playlist tracks: ${error.message}`);
        networkError.originalError = error;
        networkError.isRetryable = !error.response; // Network errors are retryable
        throw networkError;
      }
    };
    
    return attemptReplace();
  }

  /**
   * Get all tracks from a playlist with retry logic
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Spotify playlist ID
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<Array>} The playlist's item entries (the track is under
   *   `item`; `track` is deprecated)
   * @throws {Error} If playlist doesn't exist (404) or other errors
   */
  static async getPlaylistTracks(accessToken, playlistId, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptGetTracks = async (retryCount = 0) => {
      try {
        const tracks = [];
        let offset = 0;
        const limit = PLAYLIST_ITEMS_PAGE_SIZE;

        while (true) {
          const response = await axios.get(
            `${SPOTIFY_API_BASE}/playlists/${playlistId}/items`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              params: {
                limit,
                offset
              }
            }
          );

          tracks.push(...response.data.items);

          if (!response.data.next) {
            break;
          }

          offset += limit;
        }

          return tracks;
      } catch (error) {
        // Handle specific Spotify API errors
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data;
          
          let spotifyMessage = error.message;
          if (responseData?.error?.message) {
            spotifyMessage = responseData.error.message;
          }
          
          // Retry on server errors (502, 503, 504) with exponential backoff
          if (status >= 500 && status < 600 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            logger.warn(`Spotify API server error (${status}) when getting playlist tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptGetTracks(retryCount + 1);
          }
          
          const customError = new Error();
          
          if (status === 404) {
            // Playlist was deleted or doesn't exist
            customError.message = `Playlist not found. It may have been deleted on Spotify.`;
            customError.statusCode = 404;
            customError.spotifyError = spotifyMessage;
            customError.isPlaylistDeleted = true;
            throw customError;
          } else if (status >= 500 && status < 600) {
            // Server errors (502, 503, 504, etc.) - Spotify API issues
            customError.message = `Spotify API is temporarily unavailable (${status}). Please try again in a moment.`;
            customError.statusCode = status;
            customError.spotifyError = spotifyMessage;
            customError.isServerError = true;
            customError.isRetryable = true;
            throw customError;
          } else if (status === 403) {
            customError.message = `Insufficient permissions to access playlist: ${spotifyMessage}`;
            customError.statusCode = 403;
            customError.spotifyError = spotifyMessage;
            throw customError;
          } else if (status === 401) {
            customError.message = `Invalid or expired Spotify access token: ${spotifyMessage}`;
            customError.statusCode = 401;
            customError.spotifyError = spotifyMessage;
            throw customError;
          }
        }
        
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries && !error.response) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Network error when getting playlist tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(delay);
          return attemptGetTracks(retryCount + 1);
        }
        
        // Network errors or other issues
        const networkError = new Error(`Failed to get playlist tracks: ${error.message}`);
        networkError.originalError = error;
        networkError.isRetryable = !error.response; // Network errors are retryable
        throw networkError;
      }
    };
    
    return attemptGetTracks();
  }

  /**
   * Follow a playlist (required for users to collaborate on collaborative playlists)
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Spotify playlist ID
   * @returns {Promise<void>} Success if following is successful
   */
  static async followPlaylist(accessToken, playlistId, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptFollow = async (retryCount = 0) => {
      try {
        // Following a playlist is saving it to the user's library since
        // February 2026. The endpoint takes Spotify URIs as a query parameter.
        await axios.put(
          `${SPOTIFY_API_BASE}/me/library`,
          null,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
            params: {
              uris: `spotify:playlist:${playlistId}`
            }
          }
        );
        return;
      } catch (error) {
        // Handle specific Spotify API errors
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data;
          
          let spotifyMessage = error.message;
          if (responseData?.error?.message) {
            spotifyMessage = responseData.error.message;
          }
          
          // Retry on server errors (502, 503, 504) with exponential backoff
          if (status >= 500 && status < 600 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            logger.warn(`Spotify API server error (${status}) when following playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptFollow(retryCount + 1);
          }
          
          // The old follow endpoint's 403 was read as "already following".
          // Saving to the library is a PUT, so saving again isn't a refusal;
          // a 403 here is a real one (for example a missing scope).
          if (status === 403) {
            const forbidden = new Error(`Spotify refused to follow the playlist: ${spotifyMessage}`);
            forbidden.statusCode = 403;
            throw forbidden;
          } else if (status === 404) {
            throw new Error(`Playlist not found: ${spotifyMessage}`);
          } else if (status === 401) {
            throw new Error(`Invalid or expired Spotify access token: ${spotifyMessage}`);
          } else if (status >= 500 && status < 600) {
            // Server errors after retries exhausted
            throw new Error(`Spotify API is temporarily unavailable (${status}). Please try again in a moment.`);
          }
        }
        
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries && !error.response) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Network error when following playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(delay);
          return attemptFollow(retryCount + 1);
        }
        
        throw new Error(`Failed to follow playlist: ${error.message}`);
      }
    };
    
    return attemptFollow();
  }

  /**
   * Transfer playback to a device
   * @param {string} accessToken - Spotify access token
   * @param {string} deviceId - Device ID to transfer playback to
   * @param {boolean} play - Whether to start/resume playback after transfer (default: false)
   * @returns {Promise<void>} Success if transfer is successful
   */
  static async transferPlayback(accessToken, deviceId, play = false) {
    try {
      const response = await axios.put(
        `${SPOTIFY_API_BASE}/me/player`,
        {
          device_ids: [deviceId],
          play: Boolean(play)
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      // Handle specific Spotify API errors
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.message;
        
        // Create error with statusCode so controller can return proper HTTP status
        const customError = new Error();
        
        if (status === 404) {
          // 404 means no active playback session — device is still activated,
          // there's just nothing to play. This is not a real error.
          logger.debug('[Spotify] Transfer got 404 (no active playback) — device activated without playback');
          return { activated: true, noPlayback: true };
        } else if (status === 403) {
          customError.message = 'Insufficient permissions. Premium account required for playback control.';
          customError.statusCode = 403;
          throw customError;
        } else if (status === 401) {
          customError.message = 'Invalid or expired Spotify token';
          customError.statusCode = 401;
          throw customError;
        } else {
          customError.message = `Failed to transfer playback: ${message}`;
          customError.statusCode = status || 500;
          throw customError;
        }
      }
      // Network or other errors
      const networkError = new Error(`Failed to transfer playback: ${error.message}`);
      networkError.statusCode = 500;
      throw networkError;
    }
  }

  /**
   * Get current playback state (what's playing on any device)
   * @param {string} accessToken - Spotify access token
   * @returns {Promise<Object|null>} Current playback state or null if nothing playing
   */
  static async getCurrentPlayback(accessToken) {
    try {
      const response = await axios.get(
        `${SPOTIFY_API_BASE}/me/player`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return response.data;
    } catch (error) {
      // 204 means no active playback - this is normal, not an error
      if (error.response?.status === 204) {
        return null;
      }
      // 404 also means no active device/playback
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('[Spotify] Failed to get current playback:', error.message);
      throw error;
    }
  }

  /**
   * Get available devices
   * @param {string} accessToken - Spotify access token
   * @returns {Promise<Array>} List of available devices
   */
  static async getAvailableDevices(accessToken) {
    try {
      const response = await axios.get(
        `${SPOTIFY_API_BASE}/me/player/devices`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return response.data.devices || [];
    } catch (error) {
      logger.error('[Spotify] Failed to get available devices:', error.message);
      throw error;
    }
  }

  /**
   * Play a specific track on a device
   * @param {string} accessToken - Spotify access token
   * @param {string} deviceId - Device ID to play on
   * @param {string} trackUri - Spotify track URI (spotify:track:xxx)
   * @returns {Promise<void>} Success if playback starts
   */
  static async playTrack(accessToken, deviceId, trackUri) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Web Playback SDK devices can take a moment to appear in Spotify's
     * /me/player/devices list after the SDK emits "ready".
     * We retry a few times to avoid failing on a stale device_id.
     */
    const getDevicesWithRetry = async (attempts = 3, delayMs = 600) => {
      let lastErr = null;
      for (let i = 0; i < attempts; i += 1) {
        try {
          const devices = await this.getAvailableDevices(accessToken);
          return devices;
        } catch (err) {
          lastErr = err;
          // Backoff slightly between attempts
          if (i < attempts - 1) {
            await sleep(delayMs);
          }
        }
      }
      // If devices fetch fails consistently, bubble the last error
      throw lastErr || new Error('Failed to get available devices');
    };

    try {
      // Always target the exact device the client asked for. On a 404 we
      // only retry (transfer + play) if that same device is still listed;
      // we never pick a different device.

      // Attempt playback. If Spotify reports no active device, transfer then retry once.
      const playOnce = async () => {
        const response = await axios.put(
          `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`,
          { uris: [trackUri] },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      };

      try {
        return await playOnce();
      } catch (firstPlayError) {
        const status = firstPlayError?.response?.status;

        // 404 commonly means the device exists but isn't the active one yet.
        // If the requested device is still registered, transfer + retry once.
        if (status === 404) {
          let devices = [];
          try {
            devices = await getDevicesWithRetry(2, 500);
          } catch (deviceListError) {
            logger.warn('[Spotify] Device discovery failed during 404 fallback', {
              message: deviceListError.message
            });
          }

          // Only ever recover onto the exact device that was requested.
          // Never fall back to another device: the user's phone Spotify app
          // (an "active" device) or another Groupify tab (same "Groupify
          // Web Player" name) would silently take the audio away from the
          // device the user is actually using. If the requested device is
          // gone, surface the 404 so the client can reconnect it.
          const requestedDevice = devices.find(d => d.id === deviceId);
          if (!requestedDevice) {
            throw firstPlayError;
          }

          try {
            await this.transferPlayback(accessToken, deviceId, true);
            await sleep(800);
            return await playOnce();
          } catch (transferOrRetryError) {
            logger.warn('[Spotify] Transfer + retry after 404 failed', {
              status: transferOrRetryError?.response?.status,
              message: transferOrRetryError.message
            });
            throw firstPlayError;
          }
        }

        throw firstPlayError;
      }
    } catch (error) {
      // Handle specific Spotify API errors
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.message;
        const reason = error.response.data?.error?.reason || 'unknown';
        
        logger.error(`[Spotify] Play track error: Status ${status}, Message: ${message}, Reason: ${reason}`);
        
        // Create error with statusCode so controller can return proper HTTP status
        const customError = new Error();
        
        if (status === 404) {
          // 404 can mean device not found OR no active device
          customError.message = 'Device not found or not ready. If using the web player, wait a few seconds for the device to appear, then try again. If it still fails, open the Spotify app and start playing something once to activate Spotify Connect, then retry.';
          customError.statusCode = 404;
          throw customError;
        } else if (status === 403) {
          customError.message = 'Insufficient permissions. Spotify Premium is REQUIRED for playback control in web browsers.';
          customError.statusCode = 403;
          throw customError;
        } else if (status === 401) {
          customError.message = 'Invalid or expired Spotify token';
          customError.statusCode = 401;
          throw customError;
        } else if (status === 400) {
          customError.message = `Invalid track URI: ${message}`;
          customError.statusCode = 400;
          throw customError;
        } else if (status === 429) {
          const retryAfter = error.response.headers?.['retry-after'];
          customError.message = `Spotify rate limit exceeded${retryAfter ? `. Retry after ${retryAfter} seconds.` : '.'}`;
          customError.statusCode = 429;
          customError.retryAfter = retryAfter;
          throw customError;
        } else {
          customError.message = `Failed to play track: ${message}`;
          customError.statusCode = status || 500;
          throw customError;
        }
      }
      // Network or other errors
      const networkError = new Error(`Failed to play track: ${error.message}`);
      networkError.statusCode = 500;
      throw networkError;
    }
  }

  /**
   * Pause playback on the user's active device (or a specific device)
   */
  static async pausePlayback(accessToken, deviceId) {
    try {
      const url = deviceId
        ? `${SPOTIFY_API_BASE}/me/player/pause?device_id=${deviceId}`
        : `${SPOTIFY_API_BASE}/me/player/pause`;
      await axios.put(url, {}, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        // 403 = already paused or restricted — not a real error
        if (status === 403) return;
        if (status === 404) {
          const err = new Error('No active device found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(error.response.data?.error?.message || 'Failed to pause playback');
        err.statusCode = status;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Resume playback on the user's active device (or a specific device)
   */
  static async resumePlayback(accessToken, deviceId) {
    try {
      const url = deviceId
        ? `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`
        : `${SPOTIFY_API_BASE}/me/player/play`;
      // No body = resume current track (not start a new one)
      await axios.put(url, {}, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          const err = new Error('No active device found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(error.response.data?.error?.message || 'Failed to resume playback');
        err.statusCode = status;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Skip to the next track in the user's queue
   */
  static async skipToNext(accessToken, deviceId) {
    try {
      const url = deviceId
        ? `${SPOTIFY_API_BASE}/me/player/next?device_id=${deviceId}`
        : `${SPOTIFY_API_BASE}/me/player/next`;
      await axios.post(url, {}, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          const err = new Error('No active device found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(error.response.data?.error?.message || 'Failed to skip to next');
        err.statusCode = status;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Skip to the previous track
   */
  static async skipToPrevious(accessToken, deviceId) {
    try {
      const url = deviceId
        ? `${SPOTIFY_API_BASE}/me/player/previous?device_id=${deviceId}`
        : `${SPOTIFY_API_BASE}/me/player/previous`;
      await axios.post(url, {}, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          const err = new Error('No active device found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(error.response.data?.error?.message || 'Failed to skip to previous');
        err.statusCode = status;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Seek to a position (ms) in the currently playing track
   */
  static async seekToPosition(accessToken, positionMs, deviceId) {
    const params = new URLSearchParams({ position_ms: String(positionMs) });
    if (deviceId) params.set('device_id', deviceId);
    try {
      await axios.put(`${SPOTIFY_API_BASE}/me/player/seek?${params.toString()}`, null, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          const err = new Error('No active device found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(error.response.data?.error?.message || 'Failed to seek');
        err.statusCode = status;
        throw err;
      }
      throw error;
    }
  }
}

module.exports = SpotifyService;

