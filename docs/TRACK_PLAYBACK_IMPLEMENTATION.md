# Track Playback Implementation - In-App Player Integration

## Overview

Successfully implemented the ability to play tracks directly in the app using the SpotifyPlayerCard component instead of opening new Spotify links. When users click the play button on tracks in the GroupFeedScreen or PlaylistViewScreen, tracks now play through the integrated Spotify Web Playback SDK player.

## Files Created/Modified

### Backend Files

#### 1. `Groupify-backend/src/services/spotifyService.js`
**Changes:** Added `playTrack` method to play a specific track on a device using Spotify Web API.

**New Method:**
```javascript
static async playTrack(accessToken, deviceId, trackUri)
```
- Transfers playback to the device first
- Calls Spotify Web API `/v1/me/player/play` endpoint
- Handles errors (404, 403, 401, 400) with user-friendly messages

#### 2. `Groupify-backend/src/controllers/playerController.js`
**Changes:** Added `playTrack` controller method.

**New Method:**
```javascript
static async playTrack(req, res, next)
```
- Validates `device_id` and `track_uri` from request body
- Validates track URI format (must start with `spotify:track:`)
- Gets valid Spotify access token via TokenManager
- Calls SpotifyService.playTrack
- Returns success response with device ID and track URI

#### 3. `Groupify-backend/src/routes/playerRoutes.js`
**Changes:** Added new route for playing tracks.

**New Route:**
```javascript
router.put('/play', authMiddleware, PlayerController.playTrack);
```

### Frontend Files

#### 4. `Groupify-frontend/src/lib/api.ts`
**Changes:** Added `playTrack` API function.

**New Function:**
```typescript
export const playTrack = async (deviceId: string, trackUri: string)
```
- Makes PUT request to `/api/v1/player/play`
- Sends `device_id` and `track_uri` in request body
- Returns success response or throws error

#### 5. `Groupify-frontend/src/hooks/useSpotifyPlayer.ts`
**Changes:** Added `playTrack` method to hook return interface and implementation.

**New Method:**
```typescript
playTrack: (trackUri: string) => Promise<void>
```
- Validates device ID is available
- Validates track URI format
- Calls API function to play track
- Shows toast notifications for success/error
- Player state updates automatically via `player_state_changed` event

#### 6. `Groupify-frontend/src/components/GroupFeedScreen.tsx`
**Changes:** Updated to use player instead of opening new window.

**Updates:**
- Imported `useSpotifyPlayer` hook
- Added `handlePlayTrack` function that:
  - Checks if player is ready
  - Converts `spotifyTrackId` to track URI (`spotify:track:${id}`)
  - Calls `playTrack` from hook
  - Shows loading state during playback initiation
  - Displays success/error toasts
- Updated play button to:
  - Call `handlePlayTrack` instead of `window.open`
  - Show loading spinner when playing
  - Disable when player not ready or already playing

#### 7. `Groupify-frontend/src/components/PlaylistViewScreen.tsx`
**Changes:** Updated to use player for both individual tracks and "Play All" button.

**Updates:**
- Imported `useSpotifyPlayer` hook
- Updated `handlePlayAll` to:
  - Check if player is ready
  - Play first track using player
  - Show loading state
- Updated `handleTrackClick` to:
  - Use player instead of opening new window
  - Show loading state
- Updated play button in table to:
  - Show loading spinner when playing
  - Disable when player not ready
- Updated "Play All" button to:
  - Show loading state
  - Disable when player not ready or already playing

## API Endpoints

### PUT `/api/v1/player/play`
**Description:** Play a specific track on the user's connected device.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "device_id": "string",
  "track_uri": "spotify:track:xxx"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Track playback started successfully",
  "data": {
    "deviceId": "device_id_here",
    "trackUri": "spotify:track:xxx"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

**Error Codes:**
- `400` - Missing or invalid device_id/track_uri
- `401` - Unauthorized (invalid token)
- `404` - No active device found
- `403` - Insufficient permissions (Premium account required)

## How It Works

1. **User clicks play button** on a track in GroupFeedScreen or PlaylistViewScreen
2. **Frontend checks** if player is ready (deviceId available)
3. **Converts track ID** to Spotify URI format: `spotify:track:${spotifyTrackId}`
4. **Calls `playTrack`** from `useSpotifyPlayer` hook
5. **Hook calls API** function which makes PUT request to `/api/v1/player/play`
6. **Backend validates** request and gets valid Spotify access token
7. **Backend transfers playback** to device (if needed)
8. **Backend calls Spotify Web API** `/v1/me/player/play` with track URI
9. **Spotify starts playback** on the connected device
10. **Player state updates** automatically via `player_state_changed` event
11. **SpotifyPlayerCard** displays the currently playing track

## User Experience Improvements

### Before
- Clicking play opened a new tab/window with Spotify
- User had to switch between app and Spotify
- No integrated playback experience

### After
- Clicking play starts playback in the app
- Track appears in SpotifyPlayerCard component
- Seamless integrated experience
- Loading states show when initiating playback
- Error messages guide user if player not ready

## Testing Instructions

### Prerequisites
1. User must be authenticated (logged in with Spotify)
2. User must have Spotify Premium account (required for Web Playback SDK)
3. Backend server must be running
4. Frontend server must be running
5. SpotifyPlayerCard must be initialized (device connected)

### Test Steps

#### Test 1: Play Track from Group Feed
1. Navigate to a group feed
2. Hover over a track card
3. Click the play button that appears
4. **Expected:** 
   - Button shows loading spinner
   - Toast notification: "Playing [Track Name]"
   - Track starts playing in SpotifyPlayerCard
   - Track info appears in player card

#### Test 2: Play Track from Playlist View
1. Navigate to playlist view
2. Click on a track row
3. **Expected:**
   - Track number changes to play icon on hover
   - Clicking plays the track
   - Track starts playing in SpotifyPlayerCard

#### Test 3: Play All Button
1. Navigate to playlist view
2. Click "Play All" button
3. **Expected:**
   - Button shows "Playing..." with spinner
   - First track in playlist starts playing
   - Toast notification appears

#### Test 4: Error Handling
1. Try to play a track before player is ready
2. **Expected:**
   - Toast error: "Player is not ready. Please wait for the player to connect."
   - Button is disabled

#### Test 5: Multiple Rapid Clicks
1. Click play on a track multiple times quickly
2. **Expected:**
   - Button shows loading state
   - Only one playback request is sent
   - Button is disabled during playback initiation

### Manual Testing with curl

```bash
# Play a track (replace with actual values)
curl -X PUT http://localhost:5001/api/v1/player/play \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "YOUR_DEVICE_ID",
    "track_uri": "spotify:track:4iV5W9uYEdYUVa79Axb7Rh"
  }'
```

## Configuration

No additional configuration needed. The feature uses existing:
- Spotify Web Playback SDK (already integrated)
- Player routes (already set up)
- Authentication middleware (already configured)
- Token management (already implemented)

## Error Handling

### Frontend Errors
- **Player not ready:** Shows toast error, disables button
- **Invalid track URI:** Validated before API call
- **API errors:** Displayed via toast notifications
- **Network errors:** Handled with try/catch, shows user-friendly messages

### Backend Errors
- **Missing device_id:** Returns 400 with clear message
- **Missing track_uri:** Returns 400 with clear message
- **Invalid track URI format:** Returns 400 with format requirement
- **No active device:** Returns 404 with helpful message
- **Premium required:** Returns 403 with clear message
- **Token errors:** Handled by TokenManager, returns 401

## Performance Considerations

- **Loading states:** Prevent multiple simultaneous playback requests
- **Button disabling:** Prevents clicks while request is in progress
- **Automatic state updates:** Player state syncs via SDK events (no polling needed)
- **Error recovery:** User can retry if initial attempt fails

## Future Enhancements

Potential improvements:
1. **Queue management:** Add tracks to queue instead of replacing current track
2. **Playlist playback:** Play entire playlist sequentially
3. **Shuffle/Repeat:** Add shuffle and repeat controls
4. **Progress tracking:** Show playback progress in feed/playlist
5. **Next/Previous:** Add queue navigation controls

## Related Documentation

- [Spotify Web Playback SDK Frontend Implementation](./SPOTIFY_WEB_PLAYBACK_SDK_FRONTEND_IMPLEMENTATION.md)
- [Spotify Web Playback SDK Backend Implementation](./SPOTIFY_WEB_PLAYBACK_SDK_BACKEND_IMPLEMENTATION.md)
- [Spotify Player Card Component Implementation](./SPOTIFY_PLAYER_CARD_COMPONENT_IMPLEMENTATION.md)

