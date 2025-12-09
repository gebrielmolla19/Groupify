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
   * @returns {Promise<Object>} Created playlist data
   */
  static async createPlaylist(accessToken, userId, name, description = '', isPublic = false) {
    try {
      const response = await axios.post(
        `${SPOTIFY_API_BASE}/users/${userId}/playlists`,
        {
          name,
          description,
          public: isPublic
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
      throw new Error(`Failed to create playlist: ${error.message}`);
    }
  }

  /**
   * Add tracks to a playlist
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Spotify playlist ID
   * @param {string[]} trackUris - Array of Spotify track URIs (spotify:track:xxx)
   * @returns {Promise<Object>} Snapshot ID of the playlist
   */
  static async addTracksToPlaylist(accessToken, playlistId, trackUris) {
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
      throw new Error(`Failed to add tracks to playlist: ${error.message}`);
    }
  }

  /**
   * Transfer playback to a device
   * @param {string} accessToken - Spotify access token
   * @param {string} deviceId - Device ID to transfer playback to
   * @returns {Promise<void>} Success if transfer is successful
   */
  static async transferPlayback(accessToken, deviceId) {
    try {
      const response = await axios.put(
        `${SPOTIFY_API_BASE}/me/player`,
        {
          device_ids: [deviceId],
          play: false
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
    try {
      console.log(`[Spotify] Attempting to play track ${trackUri} on device ${deviceId}`);
      
      // First, check if device is available in Spotify's system
      let actualDeviceId = deviceId;
      try {
        const devices = await this.getAvailableDevices(accessToken);
        let targetDevice = devices.find(d => d.id === deviceId);
        
        if (!targetDevice) {
          console.warn(`[Spotify] Device ${deviceId} not found in available devices list.`);
          console.log('[Spotify] Searching for Groupify Web Player by name...');
          
          // Fallback: Search for any "Groupify Web Player" device
          targetDevice = devices.find(d => d.name && d.name.includes('Groupify Web Player'));
          
          if (targetDevice) {
            console.log(`[Spotify] ✅ Found Groupify Web Player: ${targetDevice.name} (${targetDevice.id})`);
            actualDeviceId = targetDevice.id; // Use the found device ID
          } else {
            console.warn('[Spotify] ⚠️ No Groupify Web Player found. Available devices:', devices.map(d => ({ id: d.id, name: d.name, is_active: d.is_active })));
            console.log('[Spotify] Will attempt to play with original device ID anyway - device might activate on play command');
          }
        } else {
          console.log(`[Spotify] ✅ Found device: ${targetDevice.name} (active: ${targetDevice.is_active})`);
        }
      } catch (deviceCheckError) {
        console.warn('[Spotify] Could not check available devices (non-critical):', deviceCheckError.message);
      }
      
      // Try to transfer playback to activate the device if not active
      // For Web Playback SDK devices, this usually fails until the device is activated
      // So we skip it and go straight to the play command
      /*
      try {
        await this.transferPlayback(accessToken, deviceId);
        console.log(`[Spotify] Playback transferred to device ${deviceId}`);
        // Wait for the transfer to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (transferError) {
        console.warn('[Spotify] Transfer playback failed (will try play directly):', transferError.message);
        // Continue anyway - play command might activate the device
      }
      */
      
      console.log(`[Spotify] Skipping transfer - will activate device with play command using device: ${actualDeviceId}`);
      
      // Call play endpoint with device_id - Spotify will start playback on this device
      const response = await axios.put(
        `${SPOTIFY_API_BASE}/me/player/play?device_id=${actualDeviceId}`,
        {
          uris: [trackUri]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[Spotify] ✅ Track started playing successfully`);
      return response.data;
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
          customError.message = 'Device not found or not ready. Please ensure: 1) Spotify player is connected, 2) You have Spotify Premium, 3) Player has finished initializing. Try waiting 10 seconds and try again.';
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

