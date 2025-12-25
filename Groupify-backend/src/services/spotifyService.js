const axios = require('axios');

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

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
            console.error('[Spotify API] Full error response:', JSON.stringify(responseData, null, 2));
            spotifyErrorDetails = responseData;
          }
        }
        
        // Log detailed error information for debugging
        console.error('[Spotify API] Error details:', {
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
      console.error('[Spotify API] Network error:', {
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
   * @param {number} limit - Number of results (max 50)
   * @returns {Promise<Object>} Search results
   */
  static async searchTracks(accessToken, query, limit = 20) {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          q: query,
          type: 'track',
          limit: Math.min(limit, 50)
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
   * Get multiple tracks by IDs
   * @param {string} accessToken - Spotify access token
   * @param {string[]} trackIds - Array of Spotify track IDs (max 50)
   * @returns {Promise<Object>} Tracks data
   */
  static async getTracks(accessToken, trackIds) {
    try {
      const ids = trackIds.slice(0, 50).join(',');
      const response = await axios.get(`${SPOTIFY_API_BASE}/tracks`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: { ids }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch tracks: ${error.message}`);
    }
  }

  /**
   * Get audio features for tracks
   * @param {string} accessToken - Spotify access token
   * @param {string[]} trackIds - Array of Spotify track IDs (max 100)
   * @returns {Promise<Object>} Audio features data
   */
  static async getAudioFeatures(accessToken, trackIds) {
    try {
      const ids = trackIds.slice(0, 100).join(',');
      const response = await axios.get(`${SPOTIFY_API_BASE}/audio-features`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: { ids }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch audio features: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} Token data with access_token and refresh_token
   */
  static async exchangeCodeForToken(code) {
    try {
      // Validate environment variables
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        throw new Error('Spotify client credentials not configured');
      }

      if (!process.env.SPOTIFY_REDIRECT_URI) {
        throw new Error('Spotify redirect URI not configured');
      }

      const credentials = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
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
            'Authorization': `Basic ${credentials}`,
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
        expiresIn: response.data.expires_in
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
   * @returns {Promise<Object>} New token data
   */
  static async refreshAccessToken(refreshToken) {
    try {
      const credentials = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token || refreshToken // May not always return new refresh token
      };
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Create a new playlist for the user
   * @param {string} accessToken - Spotify access token
   * @param {string} userId - Spotify user ID
   * @param {string} name - Playlist name
   * @param {string} description - Playlist description
   * @param {boolean} isPublic - Whether playlist is public (default: false)
   * @param {boolean} collaborative - Whether playlist is collaborative (default: false)
   * @returns {Promise<Object>} Created playlist data
   */
  static async createPlaylist(accessToken, userId, name, description = '', isPublic = false, collaborative = false, maxRetries = 3) {
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
          `${SPOTIFY_API_BASE}/users/${userId}/playlists`,
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
            console.log(`Spotify API server error (${status}) when creating playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
          console.log(`Network error when creating playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
        // Spotify API allows max 100 tracks per request
        const chunks = [];
        for (let i = 0; i < trackUris.length; i += 100) {
          chunks.push(trackUris.slice(i, i + 100));
        }

        const results = [];
        for (const chunk of chunks) {
          const response = await axios.post(
            `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
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
            console.log(`Spotify API server error (${status}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
          console.log(`Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
        // First, get all existing tracks to clear them
        const existingTracks = await this.getPlaylistTracks(accessToken, playlistId, maxRetries);
        
        // Clear existing tracks if any
        if (existingTracks.length > 0) {
          const trackUrisToRemove = existingTracks.map(track => ({ uri: track.track.uri }));
          
          // Spotify API allows max 100 tracks per delete request
          const chunks = [];
          for (let i = 0; i < trackUrisToRemove.length; i += 100) {
            chunks.push(trackUrisToRemove.slice(i, i + 100));
          }

          for (const chunk of chunks) {
            try {
              await axios.delete(
                `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  },
                  data: {
                    tracks: chunk
                  }
                }
              );
            } catch (deleteError) {
              // Retry delete on server errors
              if (deleteError.response?.status >= 500 && deleteError.response?.status < 600 && retryCount < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                console.log(`Spotify API server error (${deleteError.response.status}) when deleting tracks, retrying in ${delay}ms...`);
                await sleep(delay);
                // Retry the entire replace operation
                return attemptReplace(retryCount + 1);
              }
              throw deleteError;
            }
          }
        }

        // Add new tracks (this already has retry logic)
        if (trackUris.length > 0) {
          return await this.addTracksToPlaylist(accessToken, playlistId, trackUris, maxRetries);
        }

        return { snapshot_id: playlistId };
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
            console.log(`Spotify API server error (${status}) when replacing tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
          console.log(`Network error when replacing tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
   * @returns {Promise<Array>} Array of track objects
   * @throws {Error} If playlist doesn't exist (404) or other errors
   */
  static async getPlaylistTracks(accessToken, playlistId, maxRetries = 3) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const attemptGetTracks = async (retryCount = 0) => {
      try {
        const tracks = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const response = await axios.get(
            `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
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
            console.log(`Spotify API server error (${status}) when getting playlist tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
          console.log(`Network error when getting playlist tracks, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
        await axios.put(
          `${SPOTIFY_API_BASE}/playlists/${playlistId}/followers`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
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
            console.log(`Spotify API server error (${status}) when following playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await sleep(delay);
            return attemptFollow(retryCount + 1);
          }
          
          // 403 can mean user already follows, or insufficient permissions
          // 404 means playlist doesn't exist
          // Both are acceptable - we'll log but not throw for 403 (already following)
          if (status === 403) {
            // User might already be following, which is fine
            console.log(`User already follows playlist or insufficient permissions: ${spotifyMessage}`);
            return; // Don't throw - already following is acceptable
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
          console.log(`Network error when following playlist, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
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
          // 404 means no active playback session to transfer from
          // This is expected when nothing is currently playing
          customError.message = 'No active device found. Please start playback on a device first.';
          customError.statusCode = 404;
          throw customError;
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
      console.error('[Spotify] Failed to get current playback:', error.message);
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
      console.error('[Spotify] Failed to get available devices:', error.message);
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
      // Resolve the best device_id to target.
      // Priority:
      // 1) Requested deviceId if present in /devices
      // 2) Any device matching our web player name
      // 3) Any currently active device
      // 4) First available device
      let devices = [];
      try {
        devices = await getDevicesWithRetry(3, 600);
      } catch (deviceCheckError) {
        // Non-fatal: we can still attempt to play using the provided deviceId
        console.warn('[Spotify] Could not fetch available devices (will try play directly):', deviceCheckError.message);
      }

      let actualDeviceId = deviceId;
      let targetDevice = devices.find(d => d.id === deviceId);

      if (!targetDevice && devices.length > 0) {
        console.warn(`[Spotify] Device ${deviceId} not found in available devices list.`);

        // Fallback: Search for any "Groupify Web Player" device
        targetDevice = devices.find(d => d.name && d.name.includes('Groupify Web Player'));

        // If still not found, prefer an active device (best UX vs failing)
        if (!targetDevice) {
          targetDevice = devices.find(d => d.is_active);
        }

        // Final fallback: any device
        if (!targetDevice) {
          targetDevice = devices[0];
        }

        if (targetDevice?.id) {
          actualDeviceId = targetDevice.id;
        }
      }

      // If we have device data and still couldn't resolve a device, fail with a clear message.
      if (devices.length > 0 && (!actualDeviceId || typeof actualDeviceId !== 'string')) {
        const customError = new Error('No valid Spotify device ID available for playback.');
        customError.statusCode = 404;
        throw customError;
      }

      // Attempt playback. If Spotify reports no active device, transfer then retry once.
      const playOnce = async () => {
        const response = await axios.put(
          `${SPOTIFY_API_BASE}/me/player/play?device_id=${actualDeviceId}`,
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

        // 404 commonly means "No active device found" for playback endpoints.
        // Transferring playback can activate the device, especially for Web Playback SDK.
        if (status === 404) {
          try {
            await this.transferPlayback(accessToken, actualDeviceId, true);
            await sleep(800);
            return await playOnce();
          } catch (transferOrRetryError) {
            // If transfer+retry fails, throw the original play error (handled below)
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
        
        console.error(`[Spotify] Play track error: Status ${status}, Message: ${message}, Reason: ${reason}`);
        
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
}

module.exports = SpotifyService;

