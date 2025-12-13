/**
 * API Client
 * Handles authenticated API requests to the backend
 */

import { API_BASE_URL } from './config';
import { User } from '../types';

const TOKEN_STORAGE_KEY = 'groupify_token';

/**
 * Get stored authentication token from localStorage
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

/**
 * Store authentication token in localStorage
 */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

/**
 * Remove authentication token from localStorage
 */
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

/**
 * Make an authenticated API request
 */
export const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response;
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await fetchWithAuth('/auth/me');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch user');
  }

  // Map backend user to frontend User type
  const user = data.user;
  return {
    _id: user._id,
    id: user._id,
    spotifyId: user.spotifyId,
    displayName: user.displayName,
    email: user.email,
    profileImage: user.profileImage,
    groups: user.groups || [],
    isActive: user.isActive,
  };
};

/**
 * Get Spotify access token for Web Playback SDK
 */
export const getSpotifyAccessToken = async (): Promise<string> => {
  const response = await fetchWithAuth('/auth/spotify-token');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to get Spotify access token');
  }

  return data.accessToken;
};

/**
 * Get the Spotify OAuth login URL
 */
export const getLoginUrl = (): string => {
  return `${API_BASE_URL}/auth/login`;
};

/**
 * Initiate Spotify login by redirecting to backend
 */
export const login = (): void => {
  window.location.href = getLoginUrl();
};

/**
 * Logout user (call backend endpoint for logging/analytics)
 * Note: JWT logout is primarily client-side, but calling backend is good for analytics
 */
export const logout = async (): Promise<void> => {
  try {
    // Call backend logout endpoint (optional, for logging purposes)
    await fetchWithAuth('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    // Ignore errors - logout should succeed even if backend call fails
    console.warn('Backend logout call failed:', error);
  } finally {
    // Always remove token client-side
    removeToken();
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (): Promise<import('../types').UserStats> => {
  const response = await fetchWithAuth('/users/stats');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch user stats');
  }

  return data.stats;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (updates: {
  displayName?: string;
}): Promise<User> => {
  const response = await fetchWithAuth('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to update profile');
  }

  const user = data.user;
  return {
    _id: user._id,
    id: user._id,
    spotifyId: user.spotifyId,
    displayName: user.displayName,
    email: user.email,
    profileImage: user.profileImage,
    groups: user.groups || [],
    isActive: user.isActive,
  };
};

// ==================== GROUP OPERATIONS ====================

/**
 * Get all user's groups
 */
export const getUserGroups = async (): Promise<import('../types').Group[]> => {
  const response = await fetchWithAuth('/groups');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch groups');
  }

  return data.groups.map((group: any) => ({
    ...group,
    id: group._id
  }));
};

/**
 * Get group by ID
 */
export const getGroupById = async (groupId: string): Promise<import('../types').Group> => {
  const response = await fetchWithAuth(`/groups/${groupId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch group');
  }

  return {
    ...data.group,
    id: data.group._id
  };
};

/**
 * Create new group
 */
export const createGroup = async (groupData: {
  name: string;
  description?: string;
}): Promise<import('../types').Group> => {
  const response = await fetchWithAuth('/groups', {
    method: 'POST',
    body: JSON.stringify(groupData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to create group');
  }

  return {
    ...data.group,
    id: data.group._id
  };
};

/**
 * Join group with invite code only (no groupId required)
 */
export const joinGroupByCode = async (inviteCode: string): Promise<import('../types').Group> => {
  const response = await fetchWithAuth('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to join group');
  }

  return {
    ...data.group,
    id: data.group._id
  };
};

/**
 * Join group with invite code (with groupId - for backward compatibility)
 */
export const joinGroup = async (groupId: string, inviteCode: string): Promise<import('../types').Group> => {
  const response = await fetchWithAuth(`/groups/${groupId}/join`, {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to join group');
  }

  return {
    ...data.group,
    id: data.group._id
  };
};

/**
 * Leave group
 */
export const leaveGroup = async (groupId: string): Promise<{ message: string }> => {
  const response = await fetchWithAuth(`/groups/${groupId}/leave`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to leave group');
  }

  return { message: data.message };
};

// ==================== INVITE OPERATIONS ====================

/**
 * Create an invite for a group
 */
export const createInvite = async (
  groupId: string,
  invitedUserSpotifyId: string
): Promise<import('../types').Invite> => {
  const response = await fetchWithAuth(`/groups/${groupId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ invitedUserSpotifyId }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to create invite');
  }

  return {
    ...data.invite,
    id: data.invite._id
  };
};

/**
 * Accept an invite
 */
export const acceptInvite = async (
  groupId: string,
  inviteId: string
): Promise<import('../types').Group> => {
  const response = await fetchWithAuth(`/groups/${groupId}/invite/${inviteId}/accept`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to accept invite');
  }

  return {
    ...data.group,
    id: data.group._id
  };
};

/**
 * Decline an invite
 */
export const declineInvite = async (
  groupId: string,
  inviteId: string
): Promise<import('../types').Invite> => {
  const response = await fetchWithAuth(`/groups/${groupId}/invite/${inviteId}/decline`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to decline invite');
  }

  return {
    ...data.invite,
    id: data.invite._id
  };
};

/**
 * Get all invites for a group
 */
export const getGroupInvites = async (
  groupId: string
): Promise<import('../types').Invite[]> => {
  const response = await fetchWithAuth(`/groups/${groupId}/invites`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch invites');
  }

  return data.invites.map((invite: any) => ({
    ...invite,
    id: invite._id
  }));
};

/**
 * Get all pending invites for the current user (across all groups)
 */
export const getUserInvites = async (): Promise<import('../types').Invite[]> => {
  const response = await fetchWithAuth(`/groups/user/invites`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch user invites');
  }

  return data.invites.map((invite: any) => ({
    ...invite,
    id: invite._id
  }));
};

// ==================== SHARE OPERATIONS ====================

/**
 * Share a song to group
 */
export const shareSong = async (
  groupId: string,
  spotifyTrackId: string
): Promise<import('../types').Share> => {
  const response = await fetchWithAuth('/shares', {
    method: 'POST',
    body: JSON.stringify({ groupId, spotifyTrackId }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to share song');
  }

  return {
    ...data.share,
    id: data.share._id
  };
};

/**
 * Get group feed
 */
export const getGroupFeed = async (
  groupId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ shares: import('../types').Share[]; total: number; limit: number; offset: number }> => {
  const response = await fetchWithAuth(
    `/shares/groups/${groupId}?limit=${limit}&offset=${offset}`
  );
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch group feed');
  }

  return {
    shares: data.shares.map((share: any) => ({
      ...share,
      id: share._id
    })),
    total: data.total,
    limit: data.limit,
    offset: data.offset
  };
};

/**
 * Mark share as listened
 */
export const markAsListened = async (shareId: string): Promise<import('../types').Share> => {
  const response = await fetchWithAuth(`/shares/${shareId}/listen`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to mark as listened');
  }

  return {
    ...data.share,
    id: data.share._id
  };
};

/**
 * Toggle like on a share
 */
export const toggleLike = async (shareId: string): Promise<import('../types').Share> => {
  const response = await fetchWithAuth(`/shares/${shareId}/like`, {
    method: 'PUT',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to toggle like');
  }

  return {
    ...data.share,
    id: data.share._id
  };
};

// ==================== SPOTIFY OPERATIONS ====================

/**
 * Search Spotify tracks
 */
export const searchSpotifyTracks = async (
  query: string,
  limit: number = 20
): Promise<import('../types').SpotifyTrack[]> => {
  const response = await fetchWithAuth(
    `/spotify/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to search tracks');
  }

  return data.tracks;
};

/**
 * Get recently played tracks
 */
export const getRecentlyPlayed = async (
  limit: number = 20
): Promise<import('../types').SpotifyTrack[]> => {
  const response = await fetchWithAuth(`/spotify/recently-played?limit=${limit}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch recently played tracks');
  }

  // Map recently played format to track format
  return data.items.map((item: any) => item.track || item);
};

/**
 * Export group to Spotify playlist
 */
export const exportGroupToPlaylist = async (
  groupId: string,
  playlistName?: string,
  isPublic: boolean = false
): Promise<{ id: string; name: string; external_urls: { spotify: string }; tracks: { total: number } }> => {
  const response = await fetchWithAuth(`/spotify/groups/${groupId}/export-playlist`, {
    method: 'POST',
    body: JSON.stringify({ playlistName, isPublic }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to export playlist');
  }

  return data.playlist;
};

/**
 * Transfer playback to a device
 * Note: This is a non-critical operation - if it fails, the device will activate on first play
 */
export const transferPlayback = async (deviceId: string): Promise<{ success: boolean; message: string; data: { deviceId: string } }> => {
  const token = getToken();
  const url = `${API_BASE_URL}/player/transfer`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ device_id: deviceId }),
    });

    // Handle 404 gracefully - endpoint may not be available, but that's okay
    if (response.status === 404) {
      throw new Error('Transfer endpoint not available - device will activate on first play');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to transfer playback');
    }

    return data;
  } catch (error) {
    // Re-throw with a user-friendly message for 404s
    if (error instanceof Error && error.message.includes('404')) {
      throw new Error('Transfer endpoint not available - device will activate on first play');
    }
    throw error;
  }
};

/**
 * Play a specific track on a device
 */
export const playTrack = async (deviceId: string, trackUri: string): Promise<{ success: boolean; message: string; data: { deviceId: string; trackUri: string } }> => {
  const response = await fetchWithAuth('/player/play', {
    method: 'PUT',
    body: JSON.stringify({ device_id: deviceId, track_uri: trackUri }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to play track');
  }

  return data;
};

// ==================== ANALYTICS OPERATIONS ====================

/**
 * Get group activity (waveform)
 */
export const getGroupActivity = async (
  groupId: string,
  timeRange: '24h' | '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<any[]> => {
  const response = await fetchWithAuth(`/analytics/${groupId}/activity?timeRange=${timeRange}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch group activity');
  }

  return data.data;
};

/**
 * Get member vibes (radar chart)
 */
export const getMemberVibes = async (groupId: string): Promise<any[]> => {
  const response = await fetchWithAuth(`/analytics/${groupId}/vibes`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch member vibes');
  }

  return data.data;
};

/**
 * Get superlatives (hall of fame)
 */
export const getSuperlatives = async (groupId: string): Promise<any> => {
  const response = await fetchWithAuth(`/analytics/${groupId}/superlatives`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch superlatives');
  }

  return data.data;
};

// ==================== GROUP SETTINGS OPERATIONS ====================

/**
 * Get group settings
 */
export const getGroupSettings = async (groupId: string): Promise<import('../types').GroupSettings> => {
  const response = await fetchWithAuth(`/groups/${groupId}/settings`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch group settings');
  }

  return data.data;
};

/**
 * Update group settings
 */
export const updateGroupSettings = async (
  groupId: string,
  updates: { name?: string; description?: string }
): Promise<import('../types').GroupSettings> => {
  const response = await fetchWithAuth(`/groups/${groupId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to update group settings');
  }

  return data.data;
};

/**
 * Remove a member from a group
 */
export const removeGroupMember = async (
  groupId: string,
  memberId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetchWithAuth(`/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to remove member');
  }

  return { success: true, message: data.message };
};

