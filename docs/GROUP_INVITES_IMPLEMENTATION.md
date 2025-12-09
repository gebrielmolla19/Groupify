# Group Invites Implementation

## Overview
This document describes the implementation of the group invites feature, including the ability to view, accept, and decline group invitations.

## Features Implemented

### Backend Features
1. **Decline Invite** - Users can decline pending group invitations
2. **Get User Invites** - Endpoint to fetch all pending invites for the current user across all groups

### Frontend Features
1. **User Invites Section** - Dashboard section displaying all pending invites for the user
2. **Accept/Decline Functionality** - Users can accept or decline invites from both the dashboard and group feed
3. **Real-time Updates** - Invite lists refresh automatically after accepting or declining

## Files Created/Modified

### Backend Files

#### Created
- None (all functionality added to existing files)

#### Modified
1. **`Groupify-backend/src/services/inviteService.js`**
   - Added `declineInvite()` method to handle declining invites
   - Added `getUserInvites()` method to fetch all pending invites for a user

2. **`Groupify-backend/src/controllers/inviteController.js`**
   - Added `declineInvite()` controller method
   - Added `getUserInvites()` controller method

3. **`Groupify-backend/src/routes/inviteRoutes.js`**
   - Added `POST /:groupId/invite/:inviteId/decline` route
   - Added `GET /user/invites` route

### Frontend Files

#### Created
1. **`Groupify-frontend/src/hooks/useUserInvites.ts`**
   - Custom hook to manage user's pending invites across all groups
   - Provides `fetchInvites()`, `acceptInvite()`, and `declineInvite()` functions
   - Automatically fetches invites on mount

2. **`Groupify-frontend/src/components/UserInvitesSection.tsx`**
   - Component to display user's pending invites in the dashboard
   - Shows invite details, group information, and accept/decline buttons
   - Handles navigation to group feed after accepting

#### Modified
1. **`Groupify-frontend/src/lib/api.ts`**
   - Added `declineInvite()` API function
   - Added `getUserInvites()` API function

2. **`Groupify-frontend/src/hooks/useGroupInvites.ts`**
   - Added `declineInvite()` function to the hook
   - Updated to import and use `declineInvite` API function

3. **`Groupify-frontend/src/components/InvitesList.tsx`**
   - Added optional `onDeclineInvite` prop
   - Added decline button (X icon) next to accept button for received invites
   - Improved responsive layout for action buttons

4. **`Groupify-frontend/src/components/DashboardScreen.tsx`**
   - Integrated `useUserInvites` hook
   - Added `UserInvitesSection` component to display pending invites
   - Added navigation handler to redirect to group feed after accepting invite

5. **`Groupify-frontend/src/components/GroupFeedScreen.tsx`**
   - Updated to pass `declineInvite` prop to `InvitesList` component

## API Endpoints

### Decline Invite
- **Method:** `POST`
- **Path:** `/api/v1/groups/:groupId/invite/:inviteId/decline`
- **Authentication:** Required
- **Request Parameters:**
  - `groupId` (path) - Group ID
  - `inviteId` (path) - Invite ID
- **Response:**
```json
{
  "success": true,
  "message": "Invite declined successfully",
  "invite": {
    "_id": "invite_id",
    "group": { ... },
    "invitedUser": { ... },
    "invitedBy": { ... },
    "status": "declined",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get User Invites
- **Method:** `GET`
- **Path:** `/api/v1/groups/user/invites`
- **Authentication:** Required
- **Response:**
```json
{
  "success": true,
  "invites": [
    {
      "_id": "invite_id",
      "group": {
        "_id": "group_id",
        "name": "Group Name",
        "description": "Group Description",
        "inviteCode": "ABC123"
      },
      "invitedUser": {
        "_id": "user_id",
        "displayName": "User Name",
        "profileImage": "url",
        "spotifyId": "spotify_id"
      },
      "invitedBy": {
        "_id": "inviter_id",
        "displayName": "Inviter Name",
        "profileImage": "url",
        "spotifyId": "spotify_id"
      },
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Frontend Components

### UserInvitesSection
A card component that displays all pending invites for the current user.

**Props:**
- `invites: Invite[]` - Array of pending invites
- `onAcceptInvite: (groupId: string, inviteId: string) => Promise<any>` - Handler for accepting invites
- `onDeclineInvite: (groupId: string, inviteId: string) => Promise<void>` - Handler for declining invites
- `isLoading: boolean` - Loading state
- `onNavigateToGroup?: (group: Group) => void` - Optional callback to navigate to group after accepting

**Features:**
- Shows invite count in header
- Displays inviter information with avatar
- Shows group name and description
- Displays relative time (e.g., "2 hours ago")
- Accept button navigates to group feed
- Decline button removes invite from list
- Hides section when no invites are present

### Updated InvitesList
Enhanced to support declining invites in addition to accepting.

**New Props:**
- `onDeclineInvite?: (groupId: string, inviteId: string) => Promise<void>` - Optional handler for declining invites

**Features:**
- Decline button (X icon) appears next to accept button for received invites
- Improved responsive layout with proper spacing
- Maintains existing functionality for sent invites

## User Flow

### Viewing Invites
1. User navigates to Dashboard
2. `UserInvitesSection` automatically fetches pending invites on mount
3. If invites exist, they are displayed in a card with:
   - Inviter's name and avatar
   - Group name and description
   - Time since invite was sent
   - Accept and Decline buttons

### Accepting an Invite
1. User clicks "Accept" button
2. Frontend calls `acceptInvite()` API
3. Backend updates invite status to "accepted" and adds user to group
4. Frontend refreshes invite list (removes accepted invite)
5. User is automatically navigated to the group feed
6. Success toast notification is shown

### Declining an Invite
1. User clicks decline button (X icon)
2. Frontend calls `declineInvite()` API
3. Backend updates invite status to "declined"
4. Frontend refreshes invite list (removes declined invite)
5. Success toast notification is shown

## Testing

### Backend Testing
```bash
# Decline an invite
curl -X POST http://localhost:5000/api/v1/groups/{groupId}/invite/{inviteId}/decline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Get user invites
curl http://localhost:5000/api/v1/groups/user/invites \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Testing
1. **View Invites:**
   - Navigate to Dashboard
   - Verify invites section appears if user has pending invites
   - Verify section is hidden if no invites

2. **Accept Invite:**
   - Click "Accept" button on an invite
   - Verify invite is removed from list
   - Verify navigation to group feed
   - Verify success toast appears

3. **Decline Invite:**
   - Click decline button (X) on an invite
   - Verify invite is removed from list
   - Verify success toast appears

4. **Group Feed Invites:**
   - Navigate to a group feed
   - Verify invites sidebar shows pending invites
   - Test accept/decline functionality from sidebar

## Error Handling

### Backend
- Returns 404 if invite not found
- Returns 403 if user tries to decline invite not meant for them
- Returns 400 if invite is already accepted/declined
- All errors are passed through error middleware

### Frontend
- Errors are caught and displayed via toast notifications
- Loading states prevent duplicate requests
- Error messages are user-friendly

## Security Considerations

1. **Authorization:**
   - Users can only decline invites meant for them
   - Backend verifies invite ownership before processing

2. **Validation:**
   - Invite status is validated (must be "pending")
   - Group existence and active status are verified

3. **Data Protection:**
   - User IDs are validated on both frontend and backend
   - No sensitive data is exposed in error messages

## Future Enhancements

Potential improvements for future iterations:
1. Real-time invite notifications using WebSockets
2. Email notifications for new invites
3. Bulk accept/decline functionality
4. Invite expiration dates
5. Reminder notifications for pending invites
6. Invite history view

## Configuration

No additional configuration is required. The feature uses existing:
- Authentication middleware
- Error handling middleware
- Database models and schemas
- API routing structure

