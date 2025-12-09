# Track Sharing Feature Implementation

## Overview

This document describes the implementation of the track sharing functionality in the Groupify application. Users can now search for tracks from Spotify and share them directly to their groups through an intuitive search interface.

## Feature Summary

The track sharing feature allows users to:
1. **Search for tracks** from Spotify using a real-time search bar
2. **View search results** in a dropdown with track information (album art, name, artist)
3. **Share tracks** to groups with a single click
4. **See immediate feedback** with loading states and success/error notifications

## Files Modified

### Frontend

#### `Groupify-frontend/src/components/GroupFeedScreen.tsx`
- **Purpose**: Main component for the group feed page with track sharing functionality
- **Changes**:
  - Added Spotify search integration using `useSpotifySearch` hook
  - Implemented search input with debounced search (300ms delay)
  - Created search results dropdown that appears below the search bar
  - Added track selection and sharing functionality
  - Implemented loading states for search and sharing operations
  - Added click-outside detection to close search results
  - Updated "Add Member" button to match design (circular icon button)
  - Integrated `shareTrack` function from `useGroupFeed` hook

**Key Features**:
- **Debounced Search**: Prevents excessive API calls by waiting 300ms after user stops typing
- **Search Results Dropdown**: Shows up to 10 tracks with album art, track name, and artist
- **Loading States**: Shows spinner during search and when sharing a track
- **Error Handling**: Displays user-friendly error messages via toast notifications
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Architecture

### Component Flow

```
GroupFeedScreen
├── Search Input (with debounce)
├── useSpotifySearch Hook
│   └── searchSpotifyTracks API call
├── Search Results Dropdown
│   ├── Track List (ScrollArea)
│   └── Track Item (with share button)
└── useGroupFeed Hook
    └── shareTrack function
        └── shareSong API call
```

### Data Flow

1. **User types in search bar** → `searchQuery` state updates
2. **Debounce effect triggers** → Calls `search()` from `useSpotifySearch` after 300ms
3. **API call to backend** → `/api/v1/spotify/search?q={query}&limit=10`
4. **Backend searches Spotify** → Returns track results
5. **Results displayed** → Search dropdown shows tracks with album art
6. **User clicks track** → `handleShareTrack()` called
7. **Share API call** → `/api/v1/shares` with `groupId` and `spotifyTrackId`
8. **Track added to feed** → Feed updates immediately with new share
9. **Success notification** → Toast message confirms sharing

## API Endpoints Used

### Search Tracks
- **Endpoint**: `GET /api/v1/spotify/search`
- **Query Parameters**:
  - `q` (required): Search query string
  - `limit` (optional): Number of results (default: 20, we use 10)
- **Authentication**: Required (JWT token)
- **Response**:
  ```json
  {
    "success": true,
    "tracks": [
      {
        "id": "spotify-track-id",
        "name": "Track Name",
        "artists": [{"name": "Artist Name", "id": "artist-id"}],
        "album": {
          "name": "Album Name",
          "images": [{"url": "image-url", "height": 640, "width": 640}]
        },
        "duration_ms": 180000,
        "preview_url": "preview-url",
        "external_urls": {"spotify": "spotify-url"}
      }
    ],
    "total": 100,
    "limit": 10
  }
  ```

### Share Track
- **Endpoint**: `POST /api/v1/shares`
- **Request Body**:
  ```json
  {
    "groupId": "group-id",
    "spotifyTrackId": "spotify-track-id"
  }
  ```
- **Authentication**: Required (JWT token)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Song shared successfully",
    "share": {
      "_id": "share-id",
      "group": "group-id",
      "sharedBy": {
        "_id": "user-id",
        "displayName": "User Name",
        "profileImage": "image-url"
      },
      "spotifyTrackId": "spotify-track-id",
      "trackName": "Track Name",
      "artistName": "Artist Name",
      "albumName": "Album Name",
      "trackImage": "image-url",
      "trackExternalUrl": "spotify-url",
      "listeners": [],
      "listenCount": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```

## User Experience

### Search Flow

1. **User focuses on search bar** → Placeholder text visible
2. **User types query** → Search input updates in real-time
3. **After 300ms of no typing** → Search API call triggered
4. **Loading state** → Spinner shown with "Searching..." text
5. **Results appear** → Dropdown shows up to 10 tracks
6. **User hovers track** → Plus icon appears, background highlights
7. **User clicks track** → Track shares immediately
8. **Success** → Toast notification, search clears, dropdown closes

### Visual Design

- **Search Bar**: 
  - Full width in header
  - Search icon on left
  - Placeholder: "Search and add a track from Spotify..."
  - Dark background with border

- **Search Results Dropdown**:
  - Appears below search bar
  - Maximum height: 400px with scroll
  - Dark card background
  - Border and shadow for depth
  - Each track item:
    - Album art (64x64px) or music icon fallback
    - Track name (bold)
    - Artist name (muted)
    - Plus icon on hover (green)

- **Loading States**:
  - Spinner during search
  - Spinner on individual track when sharing
  - Disabled state prevents double-clicks

## Error Handling

### Search Errors
- **Network errors**: Displayed via toast notification
- **Empty results**: Dropdown shows nothing (gracefully handles)
- **API errors**: Error message shown in toast, search results cleared

### Share Errors
- **Network errors**: Toast notification with error message
- **Validation errors**: Backend returns 400 with message
- **Permission errors**: Backend returns 403 if user not in group
- **Duplicate shares**: Backend handles (no error, just returns existing share)

## Performance Optimizations

1. **Debounced Search**: Reduces API calls by waiting 300ms after typing stops
2. **Limited Results**: Only fetches 10 tracks at a time
3. **ScrollArea**: Efficient scrolling for long result lists
4. **Image Optimization**: Uses smallest album image from Spotify API
5. **State Management**: Prevents unnecessary re-renders with proper state updates

## Accessibility Features

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: 
  - Tab to navigate search results
  - Enter to select/share track
  - Escape to close dropdown
- **Screen Reader Support**: 
  - Track names and artists announced
  - Loading states announced
  - Error messages announced
- **Focus Management**: Proper focus handling when dropdown opens/closes

## Testing Instructions

### Manual Testing

1. **Search Functionality**:
   ```bash
   # Navigate to a group feed page
   # Type in search bar: "Bohemian Rhapsody"
   # Wait for results to appear
   # Verify tracks are displayed with album art
   ```

2. **Share Functionality**:
   ```bash
   # Search for a track
   # Click on a track in results
   # Verify toast notification appears
   # Verify track appears in feed immediately
   # Verify search clears after sharing
   ```

3. **Error Scenarios**:
   ```bash
   # Test with no internet connection
   # Test with invalid search query
   # Test sharing when not a group member
   ```

### API Testing

```bash
# Search tracks
curl -X GET "http://localhost:5000/api/v1/spotify/search?q=bohemian&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Share track
curl -X POST "http://localhost:5000/api/v1/shares" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "GROUP_ID",
    "spotifyTrackId": "SPOTIFY_TRACK_ID"
  }'
```

## Future Enhancements

1. **Search History**: Remember recent searches
2. **Recently Played**: Show user's recently played tracks as quick options
3. **Search Filters**: Filter by genre, year, popularity
4. **Preview Playback**: Play 30-second previews before sharing
5. **Bulk Sharing**: Share multiple tracks at once
6. **Search Suggestions**: Autocomplete suggestions as user types
7. **Keyboard Shortcuts**: Quick keyboard shortcuts for common actions

## Configuration

No additional configuration needed. The feature uses existing:
- Spotify API integration (already configured)
- Authentication system (JWT tokens)
- API base URL from `src/lib/config.ts`

## Dependencies

### Frontend
- `lucide-react`: Icons (Search, Plus, Loader2, Music2)
- `sonner`: Toast notifications
- `date-fns`: Date formatting (for feed items)
- `@radix-ui/react-scroll-area`: Scrollable search results

### Backend
- `spotifyService`: Handles Spotify API calls
- `tokenManager`: Manages Spotify access tokens
- `shareService`: Handles share creation logic

## Troubleshooting

### Search Not Working
- **Check**: User is authenticated (has valid JWT token)
- **Check**: Spotify token is valid (not expired)
- **Check**: Backend Spotify routes are registered in `app.js`
- **Check**: Network tab for API errors

### Tracks Not Sharing
- **Check**: User is a member of the group
- **Check**: Group ID is valid
- **Check**: Spotify track ID is valid
- **Check**: Backend share routes are registered
- **Check**: Console for error messages

### Search Results Not Showing
- **Check**: Search query is not empty
- **Check**: Debounce is working (wait 300ms)
- **Check**: `showSearchResults` state is true
- **Check**: Search results array is not empty
- **Check**: Dropdown z-index (should be 50)

## Related Documentation

- [API Reference](./API_REFERENCE.md) - Full API documentation
- [Authentication Guide](./AUTHENTICATION_GUIDE.md) - Auth flow details
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) - Overall architecture

## Summary

The track sharing feature is now fully implemented and functional. Users can seamlessly search for tracks from Spotify and share them to their groups with a modern, intuitive interface. The implementation follows all coding conventions, includes proper error handling, loading states, and accessibility features.

