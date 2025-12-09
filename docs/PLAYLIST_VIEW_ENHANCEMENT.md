# Playlist View Enhancement Implementation

## Overview

This document describes the enhancement of the Playlist View feature in Groupify. The playlist view has been transformed from a mock data display into a fully functional, data-driven component with sorting, export capabilities, and real-time statistics.

## Feature Summary

The enhanced Playlist View now provides:
1. **Real Data Integration** - Displays actual tracks shared in the group
2. **Functional Sorting** - Sort by most listened, recently added, alphabetical, or shared by
3. **Play All Functionality** - Quick access to play tracks
4. **Export to Spotify** - Create a Spotify playlist from group shares
5. **Real Statistics** - Calculate and display total duration, track count, and unique artists
6. **Loading & Error States** - Proper handling of async operations

## Files Created/Modified

### Backend

#### `Groupify-backend/src/services/spotifyService.js`
- **Added Methods**:
  - `createPlaylist()` - Creates a new Spotify playlist for the user
  - `addTracksToPlaylist()` - Adds tracks to a playlist (handles chunking for 100+ tracks)

#### `Groupify-backend/src/controllers/spotifyController.js`
- **Added Method**:
  - `exportGroupToPlaylist()` - Exports all group shares to a Spotify playlist
  - Verifies group membership
  - Creates playlist with group name and description
  - Adds all tracks from group shares

#### `Groupify-backend/src/routes/spotifyRoutes.js`
- **Added Route**:
  - `POST /api/v1/spotify/groups/:groupId/export-playlist` - Export group to Spotify playlist

### Frontend

#### `Groupify-frontend/src/hooks/usePlaylist.ts` (NEW)
- **Purpose**: Custom hook for managing playlist data and state
- **Features**:
  - Fetches all shares for a group (up to 1000 tracks)
  - Implements sorting logic (most listened, recently added, alphabetical, shared by)
  - Calculates playlist statistics (total tracks, duration, unique artists)
  - Formats duration as "Xh Ym" or "Ym"

#### `Groupify-frontend/src/components/PlaylistViewScreen.tsx`
- **Complete Rewrite**: Replaced mock data with real implementation
- **Features**:
  - Real data from `usePlaylist` hook
  - Functional sorting dropdown
  - "Play All" button (opens first track in Spotify)
  - "Export" button (creates Spotify playlist)
  - Real statistics display
  - Loading states with skeletons
  - Error handling
  - Empty state with CTA

#### `Groupify-frontend/src/lib/api.ts`
- **Added Function**:
  - `exportGroupToPlaylist()` - API call to export group to Spotify playlist

## Architecture

### Data Flow

```
PlaylistViewScreen
├── usePlaylist Hook
│   ├── Fetches shares via getGroupFeed API
│   ├── Sorts shares based on selected option
│   └── Calculates statistics
├── Sort Dropdown
│   └── Updates sortBy state → triggers re-sort
├── Play All Button
│   └── Opens first track in Spotify
└── Export Button
    ├── Calls exportGroupToPlaylist API
    ├── Creates Spotify playlist
    └── Opens playlist in Spotify
```

### Sorting Logic

1. **Most Listened**: `sort((a, b) => b.listenCount - a.listenCount)`
2. **Recently Added**: `sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))`
3. **Alphabetical**: `sort((a, b) => a.trackName.localeCompare(b.trackName))`
4. **Shared By**: `sort((a, b) => a.sharedBy.displayName.localeCompare(b.sharedBy.displayName))`

## API Endpoints

### Export Group to Playlist
- **Endpoint**: `POST /api/v1/spotify/groups/:groupId/export-playlist`
- **Authentication**: Required (JWT token)
- **Request Body**:
  ```json
  {
    "playlistName": "Optional Custom Name",
    "isPublic": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Playlist created successfully",
    "playlist": {
      "id": "spotify-playlist-id",
      "name": "Group Name - Groupify Playlist",
      "external_urls": {
        "spotify": "https://open.spotify.com/playlist/..."
      },
      "tracks": {
        "total": 25
      }
    }
  }
  ```

## User Experience

### Playlist View Features

1. **Header Section**:
   - Back button to group feed
   - Group name and track count
   - Sort dropdown (4 options)
   - Export button (with loading state)
   - Play All button

2. **Hero Section**:
   - Large playlist icon
   - Group name and description
   - Stats: members, songs, total duration

3. **Table View**:
   - Track number (shows play icon on hover)
   - Track name and artist
   - Album name (hidden on mobile)
   - Shared by (with avatar, hidden on mobile)
   - Play count (hidden on mobile)
   - Duration

4. **Interactive Elements**:
   - Click any row to open track in Spotify
   - Hover shows play icon instead of number
   - Top tracks marked with trending icon
   - Loading states during export

### Sorting Options

- **Most Listened**: Tracks with highest listen counts first
- **Recently Added**: Newest shares first (default feed order)
- **Alphabetical**: A-Z by track name
- **Shared By**: Grouped by sharer name

### Export Flow

1. User clicks "Export" button
2. Button shows loading state ("Exporting...")
3. Backend creates Spotify playlist with all group tracks
4. Success toast notification
5. Playlist opens in Spotify automatically
6. Button returns to normal state

## Statistics Calculation

### Total Duration
- Sums all `durationMs` from shares
- Formats as:
  - `"2h 45m"` if hours > 0
  - `"45m"` if hours = 0

### Unique Artists
- Creates Set from all `artistName` values
- Counts unique entries

### Total Tracks
- Simple count of shares array length

## Error Handling

### API Errors
- Network errors: Toast notification with error message
- No tracks: Toast "No tracks to export"
- Permission errors: Backend returns 403 if not group member
- Empty playlist: Shows empty state with CTA to group feed

### Loading States
- Initial load: Skeleton table rows
- Export: Button shows spinner and "Exporting..." text
- Disabled states: Buttons disabled when no tracks available

## Performance Optimizations

1. **Memoized Sorting**: Uses `useMemo` to avoid re-sorting on every render
2. **Memoized Stats**: Statistics calculated once and cached
3. **Efficient Fetching**: Single API call for all tracks (up to 1000)
4. **Chunked Playlist Creation**: Backend handles 100+ tracks in chunks

## Accessibility Features

- **ARIA Labels**: All interactive elements labeled
- **Keyboard Navigation**: Table rows clickable, buttons focusable
- **Screen Reader Support**: 
  - Track information announced
  - Loading states announced
  - Error messages announced
- **Focus Management**: Proper focus handling for buttons

## Testing Instructions

### Manual Testing

1. **View Playlist**:
   ```bash
   # Navigate to a group
   # Click "View Playlist" button
   # Verify tracks are displayed in table
   # Verify stats are correct
   ```

2. **Sorting**:
   ```bash
   # Change sort option in dropdown
   # Verify tracks reorder correctly
   # Test all 4 sort options
   ```

3. **Play All**:
   ```bash
   # Click "Play All" button
   # Verify first track opens in Spotify
   ```

4. **Export**:
   ```bash
   # Click "Export" button
   # Wait for export to complete
   # Verify playlist opens in Spotify
   # Check Spotify account for new playlist
   ```

### API Testing

```bash
# Export group to playlist
curl -X POST "http://localhost:5000/api/v1/spotify/groups/GROUP_ID/export-playlist" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "playlistName": "My Custom Playlist",
    "isPublic": false
  }'
```

## Future Enhancements

1. **Play All in Spotify**: Create playlist and open it (instead of just first track)
2. **Infinite Scroll**: Load more tracks as user scrolls
3. **Filter Options**: Filter by artist, genre, date range
4. **Playlist Management**: Update existing playlists instead of creating new ones
5. **Batch Operations**: Select multiple tracks for actions
6. **Playlist Sharing**: Share playlist link with group members
7. **Sync Playlist**: Auto-update Spotify playlist when new tracks are shared

## Configuration

No additional configuration needed. The feature uses existing:
- Spotify API integration (already configured)
- Authentication system (JWT tokens)
- API base URL from `src/lib/config.ts`

## Dependencies

### Backend
- `axios`: HTTP requests to Spotify API
- `mongoose`: Database queries for shares and groups

### Frontend
- `lucide-react`: Icons (Play, Clock, Filter, TrendingUp, Loader2, ExternalLink)
- `sonner`: Toast notifications
- `date-fns`: Date formatting utilities
- `@radix-ui/react-select`: Sort dropdown component

## Troubleshooting

### Export Not Working
- **Check**: User is authenticated (has valid JWT token)
- **Check**: User is a member of the group
- **Check**: Spotify token is valid (not expired)
- **Check**: Group has tracks to export
- **Check**: Network tab for API errors

### Sorting Not Working
- **Check**: `sortBy` state is updating correctly
- **Check**: `useMemo` dependencies are correct
- **Check**: Shares array is not empty

### Stats Incorrect
- **Check**: `durationMs` is set correctly in shares
- **Check**: `artistName` format is consistent
- **Check**: Shares array includes all tracks

## Related Documentation

- [Track Sharing Implementation](./TRACK_SHARING_IMPLEMENTATION.md) - How tracks are shared
- [API Reference](./API_REFERENCE.md) - Full API documentation
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) - Overall architecture

## Summary

The Playlist View has been successfully enhanced from a mock data display to a fully functional feature. Users can now:
- View all shared tracks in a clean table format
- Sort tracks by various criteria
- Export the entire group playlist to Spotify
- See real-time statistics about the playlist
- Interact with tracks directly (play in Spotify)

The implementation follows all coding conventions, includes proper error handling, loading states, and accessibility features. The feature is production-ready and provides a clear distinction from the social feed view.

