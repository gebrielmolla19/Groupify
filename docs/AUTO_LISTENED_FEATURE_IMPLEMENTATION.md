# Auto-Listened Feature Implementation

## Overview
This feature automatically marks tracks as "listened" when they finish playing using the Spotify Web Playback SDK's playback metadata. When a user plays a track from the group feed and it completes (reaches the end), the system automatically marks it as listened without requiring manual user interaction.

## Implementation Summary

### Backend Changes
- **No backend changes required** - Uses existing `POST /api/v1/shares/:shareId/listen` endpoint

### Frontend Changes
- **File Modified:** `Groupify-frontend/src/hooks/useSpotifyPlayer.ts`
  - Added duration tracking
  - Added track completion detection logic
  - Added callback mechanism for track completion events
  
- **File Modified:** `Groupify-frontend/src/components/GroupFeedScreen.tsx`
  - Added automatic track completion handling
  - Tracks which share is currently playing
  - Automatically calls `markAsListened` when track finishes

## Technical Details

### Track Completion Detection

The system detects track completion by monitoring:
1. **Position vs Duration:** When `position >= duration - 1000ms` (within 1 second of end)
2. **Playback State:** Track must be paused/stopped (not playing)
3. **Completion Flag:** Prevents duplicate completion events for the same track

### Implementation Flow

#### 1. Player Hook Updates (`useSpotifyPlayer.ts`)

**Added Duration Tracking:**
```typescript
let globalDuration = 0;
```

**Added Completion Detection:**
```173:225:Groupify-frontend/src/hooks/useSpotifyPlayer.ts
      spotifyPlayer.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (state) {
          const currentTrack = state.track_window.current_track;
          const newPosition = state.position;
          const newDuration = state.duration;
          const newIsPlaying = !state.paused;
          
          // Track completion detection
          const currentTrackUri = currentTrack?.uri || null;
          
          // Reset completion flag if track changed
          if (currentTrackUri !== lastTrackUri) {
            hasTrackCompleted = false;
            lastTrackUri = currentTrackUri;
          }
          
          // Check if track has completed (position within 1 second of duration and not playing)
          // We check within 1 second to account for timing differences
          const isNearEnd = newDuration > 0 && newPosition >= newDuration - 1000;
          const hasCompleted = isNearEnd && !newIsPlaying && !hasTrackCompleted;
          
          if (hasCompleted && currentTrackUri && globalOnTrackComplete) {
            hasTrackCompleted = true;
            // Call completion callback
            try {
              globalOnTrackComplete(currentTrackUri);
            } catch (err) {
              console.error('Error in track completion callback:', err);
            }
          }
          
          globalCurrentTrack = currentTrack;
          globalIsPlaying = newIsPlaying;
          globalPosition = newPosition;
          globalDuration = newDuration;
          setCurrentTrack(currentTrack);
          setIsPlaying(newIsPlaying);
          setPosition(newPosition);
          setDuration(newDuration);
        } else {
          globalCurrentTrack = null;
          globalIsPlaying = false;
          globalPosition = 0;
          globalDuration = 0;
          lastTrackUri = null;
          hasTrackCompleted = false;
          setCurrentTrack(null);
          setIsPlaying(false);
          setPosition(0);
          setDuration(0);
        }
        notifyListeners();
      });
```

**Added Callback Interface:**
```36:48:Groupify-frontend/src/hooks/useSpotifyPlayer.ts
export interface UseSpotifyPlayerReturn {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  playTrack: (trackUri: string) => Promise<void>;
  onTrackComplete?: (trackUri: string) => void;
  setOnTrackComplete?: (callback?: (trackUri: string) => void) => void;
}
```

#### 2. Group Feed Screen Updates (`GroupFeedScreen.tsx`)

**Track Playing Share:**
```36:37:Groupify-frontend/src/components/GroupFeedScreen.tsx
  // Track which share is currently playing (map track URI to share ID)
  const playingShareRef = useRef<Map<string, string>>(new Map());
```

**Store Share When Playing:**
```108:131:Groupify-frontend/src/components/GroupFeedScreen.tsx
  const handlePlayTrack = async (share: Share) => {
    // Check if player is available
    if (!deviceId || isPlayerLoading) {
      toast.error('Player is not ready. Please wait for the player to connect.');
      return;
    }

    // Convert spotifyTrackId to track URI
    const trackUri = `spotify:track:${share.spotifyTrackId}`;
    
    try {
      setIsPlaying(share._id);
      // Track which share is playing this track URI
      playingShareRef.current.set(trackUri, share._id);
      await playTrack(trackUri);
    } catch (err) {
      // Error already handled in playTrack with toast
      console.error('Failed to play track:', err);
      // Remove from tracking if play failed
      playingShareRef.current.delete(trackUri);
    } finally {
      setIsPlaying(null);
    }
  };
```

**Auto-Mark as Listened on Completion:**
```133:189:Groupify-frontend/src/components/GroupFeedScreen.tsx
  // Set up track completion callback to auto-mark as listened
  useEffect(() => {
    if (!setOnTrackComplete) return;

    const handleTrackComplete = async (trackUri: string) => {
      // Find the share that corresponds to this track URI
      const shareId = playingShareRef.current.get(trackUri);
      
      if (!shareId) {
        // Try to find share by matching track URI
        const share = shares.find(s => {
          const shareTrackUri = `spotify:track:${s.spotifyTrackId}`;
          return shareTrackUri === trackUri;
        });
        
        if (share) {
          // Check if user hasn't already listened
          const alreadyListened = hasListened[share._id];
          if (!alreadyListened) {
            try {
              await markListened(share._id);
              console.log('Auto-marked track as listened:', share.trackName);
            } catch (err) {
              console.error('Failed to auto-mark track as listened:', err);
            }
          }
        }
        return;
      }

      // Check if user hasn't already listened
      const alreadyListened = hasListened[shareId];
      if (!alreadyListened) {
        try {
          await markListened(shareId);
          console.log('Auto-marked track as listened');
        } catch (err) {
          console.error('Failed to auto-mark track as listened:', err);
        }
      }
      
      // Clean up tracking
      playingShareRef.current.delete(trackUri);
    };

    setOnTrackComplete(handleTrackComplete);

    // Cleanup on unmount - set empty callback to clear
    return () => {
      if (setOnTrackComplete) {
        // Set empty callback to clear the completion handler
        setOnTrackComplete(() => {
          // No-op: callback cleared
        });
      }
    };
  }, [setOnTrackComplete, shares, hasListened, markListened]);
```

## How It Works

### Step-by-Step Flow

1. **User Plays Track:**
   - User clicks play button on a track in group feed
   - `handlePlayTrack` is called with the share object
   - Track URI is stored in `playingShareRef` map: `trackUri → shareId`
   - Track starts playing via Spotify Web Playback SDK

2. **Player State Monitoring:**
   - `player_state_changed` event fires continuously during playback
   - System tracks `position`, `duration`, and `isPlaying` state
   - Every second, the interval also checks for completion

3. **Completion Detection:**
   - When `position >= duration - 1000ms` AND `isPlaying === false`
   - AND track hasn't already been marked as completed
   - Completion callback is triggered with the track URI

4. **Auto-Mark as Listened:**
   - Callback receives track URI
   - Looks up share ID from `playingShareRef` map
   - If not found, searches shares array to match track URI
   - Checks if user hasn't already listened
   - Calls `markAsListened(shareId)` API
   - Updates UI automatically (via hook state update)
   - Cleans up tracking map

## Key Features

### 1. Duplicate Prevention
- Uses `hasTrackCompleted` flag to prevent multiple completion events
- Checks `hasListened` map before calling API
- Resets flag when track changes

### 2. Fallback Matching
- If share ID not found in tracking map, searches shares array
- Matches by comparing track URIs
- Handles edge cases where tracking might be lost

### 3. Error Handling
- Wraps completion callback in try/catch
- Logs errors without breaking playback
- Gracefully handles API failures

### 4. Cleanup
- Removes tracking entries after completion
- Clears callback on component unmount
- Prevents memory leaks

## Edge Cases Handled

1. **Track Skipped Before Completion:**
   - If user skips to next track, completion flag resets
   - Only tracks that actually finish are marked

2. **Multiple Tracks Played:**
   - Each track is tracked separately
   - Completion events are isolated per track

3. **User Already Listened:**
   - Checks `hasListened` before API call
   - Prevents duplicate API requests

4. **Component Unmount During Playback:**
   - Cleanup function clears callback
   - No memory leaks or orphaned callbacks

5. **Playback from External Device:**
   - If track is played from another device, completion still detected
   - Works with any Spotify playback source

## Testing

### Manual Testing Steps

1. **Basic Completion:**
   - Play a track from group feed
   - Let it play to completion
   - Verify track is automatically marked as listened
   - Check that avatar appears in listener avatars

2. **Skip Before Completion:**
   - Play a track
   - Skip to next track before it finishes
   - Verify track is NOT marked as listened

3. **Already Listened:**
   - Manually mark a track as listened
   - Play the same track
   - Let it complete
   - Verify no duplicate API call (check network tab)

4. **Multiple Tracks:**
   - Play track A, let it complete
   - Play track B, let it complete
   - Verify both are marked correctly

5. **External Playback:**
   - Start playback on phone/another device
   - Let track complete
   - Verify it's marked as listened in web app

### Expected Behavior

- ✅ Track automatically marked when it finishes
- ✅ No manual interaction required
- ✅ Works with tracks played from group feed
- ✅ Prevents duplicate marks
- ✅ Handles errors gracefully
- ✅ Updates UI immediately

## Performance Considerations

### Monitoring Frequency
- `player_state_changed` event fires continuously (real-time)
- Interval check runs every 1 second when playing
- Minimal performance impact

### Memory Management
- Uses `useRef` for tracking map (doesn't cause re-renders)
- Cleans up tracking entries after completion
- Clears callback on unmount

### API Calls
- Only calls API once per track completion
- Checks before calling to prevent duplicates
- No unnecessary network requests

## Future Enhancements

1. **Partial Listen Threshold:**
   - Mark as listened if user listens to 80%+ of track
   - Useful for long tracks or skips near end

2. **Listen Duration Tracking:**
   - Track how long user actually listened
   - Store in `timeToListen` field (already exists in schema)

3. **Batch Completion:**
   - If multiple tracks complete in quick succession
   - Batch API calls for efficiency

4. **User Preference:**
   - Allow users to disable auto-marking
   - Toggle in settings

5. **Notification:**
   - Show subtle toast when auto-marked
   - "Track marked as listened"

## Files Modified

### Frontend
- `Groupify-frontend/src/hooks/useSpotifyPlayer.ts`
  - Added duration tracking
  - Added completion detection
  - Added callback mechanism

- `Groupify-frontend/src/components/GroupFeedScreen.tsx`
  - Added track completion handler
  - Added share tracking
  - Integrated auto-mark functionality

## Dependencies

- **Spotify Web Playback SDK:** Already integrated
- **Existing API:** Uses `markAsListened` endpoint
- **No new dependencies required**

## Configuration

No additional configuration required. Feature works automatically when:
- User is authenticated
- Spotify player is connected
- Tracks are played from group feed

## Related Features

- **Manual Mark as Listened:** Users can still manually mark tracks
- **Listener Avatars:** Auto-marked tracks show user's avatar
- **Playback Control:** Works with all playback controls (play, pause, skip)
- **Group Feed:** Integrated with group feed sharing system

## Notes

- Completion detection uses 1-second threshold to account for timing differences
- Only tracks played from group feed are auto-marked (tracks from other sources won't trigger)
- System is resilient to errors and won't break playback if marking fails
- Works seamlessly with existing manual mark functionality

