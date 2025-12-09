# Listener Avatars Feature Implementation

## Overview
This feature displays the profile pictures (avatars) of group members who have listened to each track in the group feed. This provides visual feedback showing which members have engaged with shared tracks, enhancing the social aspect of the music sharing experience.

## Implementation Summary

### Backend Changes
- **File Modified:** `Groupify-backend/src/services/shareService.js`
- **Change:** Updated `getGroupFeed` method to populate the `listeners.user` field with user information (displayName, profileImage, spotifyId)
- **Impact:** The group feed now returns complete listener information, allowing the frontend to display user avatars

### Frontend Changes
- **File Modified:** `Groupify-frontend/src/components/GroupFeedScreen.tsx`
- **Change:** Added a new section below each track card that displays avatars of users who have listened to the track
- **UI Enhancement:** Shows a "Listened by:" label followed by a row of user avatars with tooltips showing display names

## Technical Details

### Backend Implementation

#### Updated Service Method
```94:100:Groupify-backend/src/services/shareService.js
    // Get shares for the group
    const shares = await Share.find({ group: groupId })
      .populate('sharedBy', 'displayName profileImage spotifyId')
      .populate('listeners.user', 'displayName profileImage spotifyId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
```

**Key Changes:**
- Added `.populate('listeners.user', 'displayName profileImage spotifyId')` to the query
- This ensures that when fetching the group feed, all listener user objects are fully populated with their profile information
- The populated data includes display name, profile image URL, and Spotify ID for each listener

### Frontend Implementation

#### New Listener Avatars Section
```360:392:Groupify-frontend/src/components/GroupFeedScreen.tsx
                      {/* Listener Avatars */}
                      {share.listeners && share.listeners.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">
                              Listened by:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {share.listeners.map((listener, index) => {
                                // Handle both populated and unpopulated listener objects
                                const listenerUser = listener.user && typeof listener.user === 'object' 
                                  ? listener.user 
                                  : null;
                                
                                if (!listenerUser) return null;

                                return (
                                  <Avatar
                                    key={listenerUser._id || listenerUser.id || index}
                                    className="w-6 h-6 border border-primary/30 shrink-0"
                                    title={listenerUser.displayName}
                                  >
                                    <AvatarImage src={listenerUser.profileImage || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                      {listenerUser.displayName?.charAt(0).toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
```

**Key Features:**
- **Conditional Rendering:** Only displays when there are listeners
- **Responsive Design:** Uses flex-wrap to handle multiple avatars gracefully
- **Avatar Component:** Uses shadcn/ui Avatar component with:
  - Profile image if available
  - Fallback to user's initial if no image
  - Tooltip showing display name on hover
  - Consistent styling with primary color theme
- **Error Handling:** Safely handles both populated and unpopulated listener objects

## Data Flow

1. **User marks track as listened:**
   - Frontend calls `POST /api/v1/shares/:shareId/listen`
   - Backend adds user to `share.listeners` array
   - Backend populates listener user info and returns updated share

2. **Group feed is loaded:**
   - Frontend calls `GET /api/v1/shares/groups/:groupId`
   - Backend fetches shares and populates both `sharedBy` and `listeners.user`
   - Frontend receives shares with fully populated listener information

3. **UI displays listeners:**
   - Frontend checks if `share.listeners` exists and has items
   - Maps through listeners and displays avatar for each user
   - Shows "Listened by:" label followed by avatars

## User Experience

### Visual Design
- **Placement:** Listener avatars appear below the main track information, separated by a border
- **Size:** Small avatars (24px) to keep the UI compact
- **Layout:** Horizontal row with wrapping for many listeners
- **Styling:** Consistent with existing design system (primary color borders, muted text)

### Accessibility
- **Tooltips:** Each avatar has a `title` attribute showing the user's display name
- **Semantic HTML:** Uses proper Avatar component with fallback text
- **Screen Readers:** Avatar fallbacks provide initial letters for identification

## Testing

### Manual Testing Steps

1. **Test Listener Display:**
   - Navigate to a group feed
   - Mark a track as listened (if not already)
   - Verify your avatar appears in the "Listened by:" section
   - Have another group member mark the same track as listened
   - Verify both avatars appear

2. **Test Multiple Listeners:**
   - Have 3+ group members mark the same track as listened
   - Verify all avatars display correctly
   - Verify avatars wrap to multiple lines if needed

3. **Test Edge Cases:**
   - Track with no listeners (should not show "Listened by:" section)
   - User without profile image (should show initial fallback)
   - User with very long display name (should truncate gracefully)

4. **Test Responsive Design:**
   - View on mobile device
   - Verify avatars display correctly on small screens
   - Verify wrapping works properly

### API Testing

```bash
# Get group feed and verify listeners are populated
curl -X GET "http://localhost:5000/api/v1/shares/groups/GROUP_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response should include:
# {
#   "success": true,
#   "shares": [
#     {
#       "_id": "...",
#       "listeners": [
#         {
#           "user": {
#             "_id": "...",
#             "displayName": "User Name",
#             "profileImage": "https://...",
#             "spotifyId": "..."
#           },
#           "listenedAt": "2024-01-01T00:00:00.000Z"
#         }
#       ]
#     }
#   ]
# }
```

## Performance Considerations

### Backend
- **Population Efficiency:** The `.populate()` call adds a database query per listener, but this is necessary for displaying user information
- **Optimization:** Consider limiting the number of listeners returned if groups become very large
- **Caching:** Listener information could be cached, but it changes frequently as users mark tracks as listened

### Frontend
- **Rendering:** Avatar components are lightweight and render efficiently
- **Conditional Rendering:** Only renders listener section when listeners exist, avoiding unnecessary DOM elements
- **Memoization:** Consider memoizing the listener avatar list if performance becomes an issue with many listeners

## Future Enhancements

1. **Click to View Profile:** Make avatars clickable to view user profiles
2. **Listener Count Badge:** Show "+X more" if there are many listeners
3. **Recent Listeners First:** Sort listeners by `listenedAt` to show most recent first
4. **Animation:** Add subtle animation when new listeners are added
5. **Grouped View:** Option to collapse/expand listener list for tracks with many listeners

## Files Modified

### Backend
- `Groupify-backend/src/services/shareService.js`
  - Updated `getGroupFeed` method to populate listeners

### Frontend
- `Groupify-frontend/src/components/GroupFeedScreen.tsx`
  - Added listener avatars display section

## Dependencies

- **Backend:** No new dependencies required
- **Frontend:** Uses existing shadcn/ui Avatar component (already installed)

## Configuration

No additional configuration required. The feature works with existing:
- User profile image storage (Spotify profile images)
- Authentication system
- Group membership verification

## Related Features

- **Track Sharing:** Users share tracks to groups
- **Mark as Listened:** Users mark tracks as listened (creates listener entry)
- **Group Feed:** Displays all shared tracks in a group
- **User Profiles:** Profile images come from Spotify user data

## Notes

- The feature gracefully handles cases where listener user data might not be populated (defensive programming)
- Avatar fallbacks ensure the UI always shows something, even without profile images
- The implementation follows existing patterns in the codebase for consistency

