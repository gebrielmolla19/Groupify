# Spotify Web Playback SDK Frontend Hook - Implementation Summary

## Overview

Successfully implemented the `useSpotifyPlayer` React hook that integrates with Spotify Web Playback SDK to enable playback control in the Groupify frontend. The hook loads the SDK script, initializes the player, automatically transfers playback to the web device, and exposes player state for use in components.

## Files Created

### 1. `Groupify-frontend/src/types/spotifyPlayer.ts`
**Purpose:** TypeScript type definitions for Spotify Web Playback SDK.

**Key Types Defined:**
- `SpotifyTrack` - Track information structure
- `SpotifyPlayerState` - Complete player state including track, position, paused status
- `WebPlaybackInstance` - Device information from ready event
- `SpotifyPlayerError` - Error structure
- `SpotifyPlayer` - Player interface with all methods (connect, disconnect, play, pause, etc.)
- `SpotifyPlayerConstructor` - Constructor type for creating player instances
- `SpotifyNamespace` - Namespace containing Player constructor
- Global `Window` interface extension for `Spotify` and `onSpotifyWebPlaybackSDKReady`

**Usage:** Provides type safety when working with Spotify SDK throughout the application.

### 2. `Groupify-frontend/src/hooks/useSpotifyPlayer.ts`
**Purpose:** Main React hook that manages Spotify Web Playback SDK integration.

**Key Features:**
- **Dynamic SDK Loading:** Loads `https://sdk.scdn.co/spotify-player.js` script only once
- **SDK Ready Handling:** Waits for `window.onSpotifyWebPlaybackSDKReady` callback
- **Player Initialization:** Creates `Spotify.Player` instance with:
  - Name: `'Groupify Web Player'`
  - OAuth token callback using `getToken()` or `useUser().token`
  - Volume: 1.0 (default)
- **Device ID Management:** Captures `device_id` from `ready` event
- **Automatic Transfer:** Calls `/api/v1/player/transfer` when device ID is received
- **State Tracking:** Subscribes to `player_state_changed` event to track:
  - Current track (`currentTrack`)
  - Playing status (`isPlaying` - inverted from `paused`)
  - Playback position (`position`)
- **Error Handling:** Handles all SDK events:
  - `ready` - Player ready with device ID
  - `not_ready` - Player disconnected
  - `player_state_changed` - Playback state updates
  - `authentication_error` - Auth failures
  - `account_error` - Account issues (e.g., Premium required)
- **Cleanup:** Disconnects player on unmount
- **Position Updates:** Polls player state every second when playing to update position

**Return Value:**
```typescript
{
  player: SpotifyPlayer | null;
  deviceId: string | null;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  position: number;
  isLoading: boolean;
  error: string | null;
}
```

## Files Modified

### 1. `Groupify-frontend/src/lib/api.ts`
**Changes:** Added `transferPlayback` function for calling the backend transfer endpoint.

**Function Signature:**
```typescript
export const transferPlayback = async (deviceId: string): Promise<{
  success: boolean;
  message: string;
  data: { deviceId: string };
}>
```

**Implementation:**
- Calls `PUT /api/v1/player/transfer` endpoint
- Sends `device_id` in request body
- Uses `fetchWithAuth` for authenticated requests
- Returns success response or throws error

**Location:** Added in the Spotify operations section, after `exportGroupToPlaylist`.

## How to Use

### Basic Usage

```typescript
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';

function MyComponent() {
  const { 
    player, 
    deviceId, 
    currentTrack, 
    isPlaying, 
    position, 
    isLoading, 
    error 
  } = useSpotifyPlayer();

  if (isLoading) {
    return <div>Loading Spotify player...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!player) {
    return <div>Player not initialized</div>;
  }

  return (
    <div>
      <p>Device ID: {deviceId}</p>
      {currentTrack && (
        <div>
          <p>Now Playing: {currentTrack.name}</p>
          <p>Artist: {currentTrack.artists[0].name}</p>
          <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
          <p>Position: {Math.floor(position / 1000)}s</p>
        </div>
      )}
    </div>
  );
}
```

### Using Player Controls

```typescript
const { player, isPlaying } = useSpotifyPlayer();

const handlePlayPause = async () => {
  if (!player) return;
  
  try {
    if (isPlaying) {
      await player.pause();
    } else {
      await player.resume();
    }
  } catch (error) {
    console.error('Playback control error:', error);
  }
};

const handleNextTrack = async () => {
  if (!player) return;
  await player.nextTrack();
};

const handlePreviousTrack = async () => {
  if (!player) return;
  await player.previousTrack();
};
```

## How to Test

### Prerequisites
1. User must be authenticated (logged in with Spotify)
2. User must have Spotify Premium account (required for Web Playback SDK)
3. Backend server must be running on `http://127.0.0.1:5001` (or configured `VITE_API_BASE_URL`)

### Testing Steps

1. **Start the frontend application:**
   ```bash
   cd Groupify-frontend
   npm run dev
   ```

2. **Log in with Spotify:**
   - Navigate to the login screen
   - Click "Login with Spotify"
   - Complete OAuth flow

3. **Import and use the hook in a component:**
   - Add the hook to any component (e.g., `DashboardScreen.tsx`)
   - Check browser console for SDK loading messages
   - Verify device ID is received

4. **Verify SDK Loading:**
   - Open browser DevTools → Network tab
   - Check for `spotify-player.js` script loading
   - Check Console for "Spotify player ready with device ID: ..."

5. **Verify Playback Transfer:**
   - Check Network tab for `PUT /api/v1/player/transfer` request
   - Verify request succeeds (200 status)
   - Check Console for "Playback transferred to device: ..."

6. **Test Playback State:**
   - Start playback on another Spotify device (phone, desktop app)
   - Verify `currentTrack`, `isPlaying`, and `position` update in the component
   - Check that track information displays correctly

7. **Test Error Scenarios:**
   - **No Premium:** Should show account error toast
   - **Invalid Token:** Should show authentication error toast
   - **Network Error:** Should show error message

### Expected Console Output

```
Spotify player ready with device ID: abc123...
Playback transferred to device: abc123...
```

### Expected Behavior

- ✅ SDK script loads automatically when user is authenticated
- ✅ Player initializes when SDK is ready
- ✅ Device ID is captured from ready event
- ✅ Transfer API is called automatically
- ✅ Player state updates when playback changes
- ✅ Errors are displayed via toast notifications
- ✅ Player disconnects on component unmount

## Technical Details

### SDK Script Loading
- **URL:** `https://sdk.scdn.co/spotify-player.js`
- **Loading Strategy:** 
  - Loads only once per app lifecycle
  - Checks if script already exists in DOM before loading
  - Uses async loading to avoid blocking
- **SDK Ready:** Waits for `window.onSpotifyWebPlaybackSDKReady` callback

### Player Initialization
- **Name:** `'Groupify Web Player'`
- **OAuth Token:** Retrieved from `getToken()` or `useUser().token`
- **Volume:** Default 1.0 (100%)
- **Connection:** Automatically connects after initialization

### Event Handling
- **ready:** Sets device ID and calls transfer API
- **not_ready:** Clears device ID and playback state
- **player_state_changed:** Updates track, playing status, and position
- **authentication_error:** Shows error toast, clears loading state
- **account_error:** Shows error toast (Premium required message)

### State Management
- Uses React `useState` for all state values
- Uses `useRef` to track initialization flags (prevents duplicate calls)
- Uses `useEffect` for script loading and cleanup
- Uses `useCallback` for player initialization function

### Position Updates
- Polls `player.getCurrentState()` every 1 second when playing
- Updates position state to reflect current playback position
- Stops polling when not playing or player is null

## Dependencies

- **React:** `useState`, `useEffect`, `useRef`, `useCallback`
- **Context:** `useUser` from `contexts/UserContext.tsx`
- **API:** `getToken`, `transferPlayback` from `lib/api.ts`
- **UI:** `toast` from `sonner` (for error notifications)

## Error Handling

The hook handles various error scenarios:

1. **Script Loading Failure:**
   - Sets error state
   - Shows toast notification
   - Stops loading state

2. **SDK Initialization Error:**
   - Catches and logs errors
   - Sets error state
   - Shows toast notification

3. **Authentication Error:**
   - Listens to `authentication_error` event
   - Shows user-friendly message
   - Suggests re-login

4. **Account Error:**
   - Listens to `account_error` event
   - Shows Premium requirement message

5. **Transfer API Error:**
   - Catches API errors
   - Logs error details
   - Shows toast notification
   - Does not prevent player from working (transfer is optional)

## Integration with Backend

The hook integrates with the backend endpoint created in the previous implementation:

- **Endpoint:** `PUT /api/v1/player/transfer`
- **Request Body:** `{ device_id: string }`
- **Authentication:** Uses JWT token from `getToken()`
- **Response:** `{ success: true, message: string, data: { deviceId: string } }`

The transfer is called automatically when the device ID is received from the SDK's `ready` event.

## Next Steps

1. **Create Player UI Component:**
   - Display current track information
   - Add play/pause button
   - Add next/previous track buttons
   - Add progress bar
   - Add volume control

2. **Add Playback Controls:**
   - Implement play/pause functionality
   - Implement seek functionality
   - Implement volume control
   - Implement track skipping

3. **Add Visual Feedback:**
   - Show loading spinner during initialization
   - Display error states with retry options
   - Show connection status

4. **Optional Context Provider:**
   - Create `SpotifyPlayerProvider` for global access
   - Allow multiple components to access player state
   - Centralize player management

5. **Enhanced Error Recovery:**
   - Retry logic for failed transfers
   - Token refresh handling
   - Reconnection logic

## Summary

The `useSpotifyPlayer` hook is fully implemented and ready for use. It provides:

- ✅ Automatic SDK loading and initialization
- ✅ Device ID capture and playback transfer
- ✅ Real-time playback state tracking
- ✅ Comprehensive error handling
- ✅ TypeScript type safety
- ✅ Clean cleanup on unmount

The hook can be imported and used in any component that needs access to Spotify playback functionality. All state is exposed through the hook's return value, making it easy to build UI components that display and control playback.

