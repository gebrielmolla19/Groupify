# Groupify Backend API

## Project Summary

**Groupify** is a Spotify-based group music-sharing web application that enables users to discover, share, and compete through music. Users can log in with their Spotify accounts, create or join groups, share their favorite tracks, and participate in fun competition analytics that track metrics like "Top Sharer", "Genre Pioneer", and "Speed Listener".

### What Makes Groupify Unique

- **Real-time Music Sharing**: Share songs instantly with your group and see who's listening in real-time
- **Competition Analytics**: Gamify music discovery with leaderboards tracking sharing habits and listening speed
- **Spotify Integration**: Seamless authentication and music discovery powered by Spotify's extensive catalog
- **Social Features**: Create groups, invite friends, and discover new music through community sharing

## Tech Stack Overview

### Core Technologies
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework for Node.js
- **MongoDB** - NoSQL database for storing user data, groups, and shares
- **Mongoose** - MongoDB object modeling for Node.js

### Integration & Real-time
- **Socket.io** - Real-time bidirectional event-based communication
- **Spotify Web API** - Music data and user authentication
- **node-cron** - Task scheduler for polling listening activity

### Authentication & Security
- **jsonwebtoken (JWT)** - Stateless authentication tokens
- **OAuth 2.0** - Spotify authentication flow

### Utilities
- **axios** - HTTP client for API requests
- **cors** - Cross-Origin Resource Sharing middleware
- **dotenv** - Environment variable management

## Folder Structure

```
backend/
├── src/
│   ├── app.js                 # Main application entry point
│   ├── routes/                # API route definitions
│   │   ├── authRoutes.js      # Authentication endpoints
│   │   ├── groupRoutes.js     # Group management endpoints
│   │   ├── shareRoutes.js     # Song sharing endpoints
│   │   └── analyticsRoutes.js # Analytics endpoints
│   ├── controllers/           # Business logic handlers
│   │   ├── authController.js
│   │   ├── groupController.js
│   │   ├── shareController.js
│   │   └── analyticsController.js
│   ├── models/                # Mongoose data models
│   │   ├── User.js           # User schema
│   │   ├── Group.js          # Group schema
│   │   └── Share.js          # Share schema
│   ├── services/              # External service integrations
│   │   └── spotifyService.js # Spotify API wrapper
│   ├── middleware/            # Express middleware
│   │   └── authMiddleware.js # JWT authentication
│   └── utils/                 # Utility functions
│       ├── tokenManager.js   # Token refresh logic
│       └── scheduler.js      # Cron job scheduler
├── package.json               # Project dependencies
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher recommended)
- MongoDB (local installation or MongoDB Atlas account)
- Spotify Developer Account

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Set Up Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables in `.env` (see Environment Variables section below)

### Step 3: Register Your Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in the app details:
   - **App Name**: Groupify (or your preferred name)
   - **App Description**: Group music-sharing application
   - **Redirect URI**: `http://localhost:5000/auth/callback`
4. After creating the app, copy your **Client ID** and **Client Secret**
5. Add these to your `.env` file

### Step 4: Set Up MongoDB

#### Option A: Local MongoDB
1. Install MongoDB locally: [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
2. Start MongoDB service
3. Update `MONGO_URI` in `.env`:
   ```
   MONGO_URI=mongodb://localhost:27017/groupify
   ```

#### Option B: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address (or use `0.0.0.0/0` for development)
5. Get your connection string and update `MONGO_URI` in `.env`:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/groupify
   ```

### Step 5: Generate JWT Secret

Generate a secure random string for your JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and add it to your `.env` file as `JWT_SECRET`.

### Step 6: Run the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

For production:

```bash
npm start
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app's Client ID | `abc123...` |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app's Client Secret | `xyz789...` |
| `SPOTIFY_REDIRECT_URI` | OAuth redirect URI (must match Spotify app settings) | `http://localhost:5000/auth/callback` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/groupify` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-random-secret-key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port number | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `FRONTEND_URL` | Frontend URL for CORS and redirects | `http://localhost:3000` |

## API Endpoints

### Authentication

- `GET /auth/login` - Initiate Spotify OAuth login
- `GET /auth/callback` - Handle OAuth callback
- `POST /auth/refresh` - Refresh Spotify access token (requires auth)
- `GET /auth/me` - Get current authenticated user (requires auth)

### Groups

- `POST /groups` - Create a new group (requires auth)
- `GET /groups` - Get all groups for current user (requires auth)
- `GET /groups/:id` - Get group details by ID (requires auth)
- `POST /groups/:id/join` - Join a group using invite code (requires auth)

### Shares

- `POST /shares` - Share a song to a group (requires auth)
  ```json
  {
    "groupId": "group_id_here",
    "spotifyTrackId": "track_id_here"
  }
  ```
- `GET /shares/groups/:groupId` - Get group feed (requires auth)
  - Query params: `limit`, `offset`

### Analytics

- `GET /analytics/:groupId/stats` - Get competition stats for a group (requires auth)
  - Returns: Top Sharer, Genre Pioneer, Speed Listener, and overall statistics

## Socket.io Events

### Client → Server Events

- `joinGroup(groupId)` - Join a group room for real-time updates
- `leaveGroup(groupId)` - Leave a group room
- `songShared(data)` - Notify about a new song share
- `songListened(data)` - Notify about a song being listened to

### Server → Client Events

- `songShared` - Emitted when a new song is shared in a group
- `songListened` - Emitted when a user listens to a shared song

## Connecting Frontend to Backend

### 1. CORS Configuration

The backend is configured to accept requests from your frontend URL. Make sure `FRONTEND_URL` in your `.env` matches your frontend's URL (default: `http://localhost:3000`).

### 2. API Base URL

In your frontend, configure the API base URL:

```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
```

### 3. Authentication Flow

1. User clicks login → redirect to `/auth/login`
2. User authorizes on Spotify → redirected to `/auth/callback`
3. Backend exchanges code for tokens → redirects to frontend with JWT token
4. Frontend stores JWT token and includes it in subsequent requests:
   ```javascript
   headers: {
     'Authorization': `Bearer ${token}`
   }
   ```

### 4. Socket.io Connection

In your frontend, connect to the Socket.io server:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  withCredentials: true
});

// Join a group room
socket.emit('joinGroup', groupId);

// Listen for events
socket.on('songShared', (data) => {
  // Update UI when song is shared
});

socket.on('songListened', (data) => {
  // Update UI when song is listened to
});
```

## Testing the Backend

### Test Login Flow

1. Start the server: `npm run dev`
2. Navigate to: `http://localhost:5000/auth/login`
3. Authorize with Spotify
4. You should be redirected back with a JWT token

### Test API Endpoints

Use a tool like Postman or curl:

```bash
# Get current user (replace TOKEN with your JWT)
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/auth/me

# Create a group
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Music Group","description":"A cool group"}' \
  http://localhost:5000/groups
```

## Background Jobs

The scheduler automatically polls Spotify's "recently played" endpoint every 5 minutes for all active users to detect when they've listened to shared songs. This updates the listening statistics and emits real-time events.

To modify the polling frequency, edit the cron schedule in `src/utils/scheduler.js`:

```javascript
// Current: every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  // ...
});
```

## Next Steps for Implementation

### Immediate Tasks

1. **Test Authentication**: Verify the Spotify OAuth flow works end-to-end
2. **Test Group Creation**: Create and join groups to ensure the flow works
3. **Test Song Sharing**: Share a song and verify it appears in the group feed
4. **Connect Frontend**: Integrate the API endpoints with your React/Next.js frontend

### Listening Tracker Enhancement

To improve the listening detection:

1. **Modify `scheduler.js`**: Adjust polling frequency or implement webhooks if available
2. **Add Immediate Detection**: Consider implementing a manual "I listened" button in addition to automatic detection
3. **Optimize Queries**: Add indexes for frequently queried fields

### Competition Analytics Enhancement

To expand analytics:

1. **Add More Metrics**: Track additional statistics like most shared artist, peak listening times
2. **Time-based Leaderboards**: Add weekly/monthly leaderboards
3. **Achievements System**: Implement badges or achievements for milestones

## Future Improvements

### Planned Features

- **Real-time Notifications**: Push notifications for new shares, listens, and group activities
- **Group Chat**: In-app messaging within groups
- **Playlist Generation**: Automatically create Spotify playlists from group shares
- **Advanced Analytics**: More detailed statistics and visualizations
- **NestJS Migration**: Consider migrating to NestJS for stronger modularity and TypeScript support

### Technical Improvements

- **Error Handling**: Enhanced error handling with custom error classes
- **Rate Limiting**: Implement rate limiting to protect API endpoints
- **Caching**: Add Redis caching for frequently accessed data
- **Testing**: Add unit tests and integration tests
- **API Documentation**: Generate OpenAPI/Swagger documentation
- **Logging**: Implement structured logging with Winston or similar
- **Monitoring**: Add health checks and monitoring tools

## Troubleshooting

### MongoDB Connection Issues

- Verify MongoDB is running (if local)
- Check connection string format in `.env`
- Ensure IP is whitelisted (if using Atlas)
- Verify database credentials

### Spotify Authentication Issues

- Verify Client ID and Secret are correct
- Ensure redirect URI matches exactly in Spotify dashboard
- Check that required scopes are requested
- Verify redirect URI is whitelisted in Spotify app settings

### Token Refresh Issues

- Check that refresh tokens are being stored correctly
- Verify token expiration times are calculated correctly
- Ensure Spotify credentials haven't expired

### Socket.io Connection Issues

- Verify CORS settings allow your frontend origin
- Check that `FRONTEND_URL` matches your frontend
- Ensure credentials are enabled in both frontend and backend

## License

ISC

## Contributing

This is a private project, but suggestions and improvements are welcome!

---

**Happy coding! 🎵**

