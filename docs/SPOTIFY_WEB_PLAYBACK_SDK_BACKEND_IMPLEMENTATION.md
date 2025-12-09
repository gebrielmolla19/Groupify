# Spotify Web Playback SDK Backend Integration - Implementation Summary

## Overview

Successfully implemented the backend endpoint for transferring Spotify playback to a device using the Spotify Web Playback SDK. This allows users to transfer their playback session to a specific device (e.g., web player) through the Groupify API.

## Files Created

### 1. `Groupify-backend/src/routes/playerRoutes.js`
**Purpose:** Defines the route for the player transfer endpoint.

**Key Features:**
- Defines `PUT /api/v1/player/transfer` endpoint
- Protected with `authMiddleware` for JWT authentication
- Routes requests to `PlayerController.transferPlayback`

**Code Structure:**
```javascript
router.put('/transfer', authMiddleware, PlayerController.transferPlayback);
```

### 2. `Groupify-backend/src/controllers/playerController.js`
**Purpose:** Handles the business logic for transferring playback to a device.

**Key Features:**
- Validates `device_id` from request body
- Uses `TokenManager.getValidAccessToken()` to ensure valid Spotify token
- Calls `SpotifyService.transferPlayback()` to transfer playback
- Updates User model with `currentDeviceId`
- Comprehensive error handling with appropriate HTTP status codes
- Logs errors for debugging

**Error Handling:**
- 400: Missing or invalid device_id
- 401: User ID not found (handled by authMiddleware)
- 404: User not found in database
- 500: Spotify API errors or server errors

## Files Modified

### 1. `Groupify-backend/src/models/User.js`
**Changes:** Added `currentDeviceId` field to track the user's currently active playback device.

**Field Definition:**
```javascript
currentDeviceId: {
  type: String,
  default: null
}
```

**Purpose:** Stores the device ID that the user's playback is currently transferred to, allowing the system to track active devices.

### 2. `Groupify-backend/src/services/spotifyService.js`
**Changes:** Added `transferPlayback` static method to handle Spotify Web API calls.

**Method Signature:**
```javascript
static async transferPlayback(accessToken, deviceId)
```

**Key Features:**
- Calls Spotify Web API: `PUT https://api.spotify.com/v1/me/player`
- Request body: `{ device_ids: [deviceId], play: false }`
- Handles specific Spotify API errors:
  - 404: No active device found
  - 403: Insufficient permissions (Premium required)
  - 401: Invalid or expired token
- Returns success response or throws descriptive errors

### 3. `Groupify-backend/src/app.js`
**Changes:** Registered player routes in the Express application.

**Added:**
- Import: `const playerRoutes = require('./routes/playerRoutes')`
- Route registration: `app.use('/api/v1/player', playerRoutes)`

**Location:** Placed after other route registrations, before Socket.io connection handling.

## API Endpoint

### `PUT /api/v1/player/transfer`

**Authentication:** Required (JWT token in Authorization header)

**Request Body:**
```json
{
  "device_id": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Playback transferred successfully",
  "data": {
    "deviceId": "DEVICE_ID"
  }
}
```

**Error Responses:**

**400 Bad Request - Missing device_id:**
```json
{
  "success": false,
  "message": "Device ID is required"
}
```

**401 Unauthorized - Invalid or missing token:**
```json
{
  "success": false,
  "message": "No token provided or invalid format. Use: Bearer <token>"
}
```

**404 Not Found - User not found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

**500 Internal Server Error - Spotify API error:**
```json
{
  "success": false,
  "message": "Failed to transfer playback: [error message]"
}
```

## Testing Instructions

### Prerequisites
1. User must be authenticated (have valid JWT token)
2. User must have Spotify Premium account
3. Device ID must be valid and active
4. User must have an active Spotify session

### Manual Testing with curl

```bash
# Replace YOUR_JWT_TOKEN and DEVICE_ID with actual values
curl -X PUT http://localhost:5000/api/v1/player/transfer \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "DEVICE_ID"}'
```

### Testing with Postman

1. **Method:** PUT
2. **URL:** `http://localhost:5000/api/v1/player/transfer`
3. **Headers:**
   - `Authorization: Bearer YOUR_JWT_TOKEN`
   - `Content-Type: application/json`
4. **Body (raw JSON):**
   ```json
   {
     "device_id": "YOUR_DEVICE_ID"
   }
   ```

### Expected Test Scenarios

1. **Valid Request:**
   - Should return 200 with success message
   - User's `currentDeviceId` should be updated in database
   - Playback should transfer to specified device

2. **Missing device_id:**
   - Should return 400 with "Device ID is required" message

3. **Invalid JWT Token:**
   - Should return 401 with authentication error

4. **Invalid Device ID:**
   - Should return 500 with Spotify API error message

5. **No Active Device:**
   - Should return 500 with "No active device found" message

## Configuration

- **No new environment variables required**
- Uses existing Spotify API credentials from `.env`:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
- Uses existing JWT secret: `JWT_SECRET`

## Technical Details

### Authentication Flow
1. Request includes JWT token in `Authorization: Bearer <token>` header
2. `authMiddleware` verifies token and sets `req.userId` and `req.user`
3. Controller uses `TokenManager.getValidAccessToken()` to get/refresh Spotify token
4. TokenManager automatically refreshes token if expired

### Spotify API Integration
- **Endpoint:** `PUT https://api.spotify.com/v1/me/player`
- **Required Scopes:** User must have authorized playback control scopes
- **Premium Required:** Yes (Spotify Web Playback SDK limitation)
- **Rate Limits:** Subject to Spotify API rate limits

### Database Updates
- User's `currentDeviceId` field is updated on successful transfer
- Field is nullable (default: `null`) to handle cases where no device is active

## Error Handling

The implementation includes comprehensive error handling:

1. **Input Validation:** Validates `device_id` is provided and is a non-empty string
2. **Authentication:** Handled by `authMiddleware` before controller execution
3. **Token Management:** `TokenManager` handles token refresh automatically
4. **Spotify API Errors:** Specific error messages for common Spotify API errors
5. **Database Errors:** Handles user not found scenarios
6. **Logging:** Errors are logged with context (userId, deviceId, timestamp) for debugging

## Next Steps

1. **Frontend Integration:**
   - Frontend can now call this endpoint to transfer playback
   - Device ID should be obtained from Spotify Web Playback SDK
   - Handle success/error responses appropriately

2. **Additional Features (Future):**
   - Get current playback state
   - Pause/Resume playback
   - Skip to next/previous track
   - Get available devices

3. **Testing:**
   - Add unit tests for `PlayerController.transferPlayback`
   - Add integration tests for the endpoint
   - Test error scenarios thoroughly

4. **Monitoring:**
   - Monitor endpoint usage and error rates
   - Track Spotify API rate limit usage
   - Log successful transfers for analytics

## Dependencies

- **express:** Web framework
- **mongoose:** MongoDB ODM (for User model)
- **axios:** HTTP client (for Spotify API calls)
- **jsonwebtoken:** JWT token verification (via authMiddleware)
- **Existing utilities:**
  - `TokenManager` (from `src/utils/tokenManager.js`)
  - `authMiddleware` (from `src/middleware/authMiddleware.js`)

## Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** Users can only transfer their own playback
3. **Token Security:** Spotify tokens are stored server-side, never exposed to client
4. **Input Validation:** Device ID is validated before processing
5. **Error Messages:** User-friendly messages without exposing sensitive details

## Summary

The backend implementation for Spotify Web Playback SDK device transfer is complete and ready for use. The endpoint follows all backend conventions:
- Layered architecture (Routes → Controllers → Services → Models)
- Proper error handling
- Input validation
- Authentication/authorization
- Consistent response format
- Comprehensive error handling

The implementation is production-ready and can be integrated with the frontend to enable device transfer functionality.

