# How Groupify Works - Complete Architecture Guide

## 🎯 Overview

Groupify is a full-stack music sharing app with a **layered architecture** that separates concerns and makes the codebase maintainable. Here's the big picture:

```
Frontend (React + TypeScript)
    ↕ HTTP Requests (REST API)
Backend (Node.js + Express)
    ↕ Database Queries
MongoDB (Data Storage)
    
Spotify API ← Backend fetches music data
Socket.io → Real-time updates (future)
```

---

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow Examples](#data-flow-examples)
3. [Frontend Structure](#frontend-structure)
4. [Backend Structure](#backend-structure)
5. [Key Features Explained](#key-features-explained)
6. [Learning Path](#learning-path)

---

## 🏗️ Architecture Overview

### Frontend Layers (React)

```
┌─────────────────────────────────────┐
│  Components (UI Layer)              │  ← What users see
│  - DashboardScreen.tsx              │
│  - GroupFeedScreen.tsx              │
│  - AnalyticsScreen.tsx              │
└─────────────────────────────────────┘
              ↕ calls
┌─────────────────────────────────────┐
│  Custom Hooks (State Management)    │  ← Business logic
│  - useGroups.ts                     │
│  - useGroupFeed.ts                  │
│  - useGroupAnalytics.ts             │
└─────────────────────────────────────┘
              ↕ calls
┌─────────────────────────────────────┐
│  API Client (lib/api.ts)            │  ← HTTP requests
│  - getUserGroups()                  │
│  - shareSong()                      │
│  - markAsListened()                 │
└─────────────────────────────────────┘
              ↕ HTTP
┌─────────────────────────────────────┐
│  Backend API                        │
└─────────────────────────────────────┘
```

### Backend Layers (Node.js)

```
┌─────────────────────────────────────┐
│  Routes (URL Mapping)               │  ← Define endpoints
│  - groupRoutes.js                   │
│  - shareRoutes.js                   │
└─────────────────────────────────────┘
              ↕ calls
┌─────────────────────────────────────┐
│  Controllers (Request Handlers)     │  ← Handle HTTP
│  - groupController.js               │
│  - shareController.js               │
└─────────────────────────────────────┘
              ↕ calls
┌─────────────────────────────────────┐
│  Services (Business Logic)          │  ← All logic here
│  - groupService.js                  │
│  - shareService.js                  │
│  - analyticsService.js              │
└─────────────────────────────────────┘
              ↕ queries
┌─────────────────────────────────────┐
│  Models (Database Schema)           │  ← Data structure
│  - Group.js                         │
│  - Share.js                         │
│  - User.js                          │
└─────────────────────────────────────┘
              ↕
┌─────────────────────────────────────┐
│  MongoDB                            │
└─────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### Example 1: Loading Dashboard Groups

**User Action:** Opens dashboard

**Flow:**
```
1. DashboardScreen.tsx renders
   └─> useGroups() hook runs
       └─> Calls getUserGroups() from api.ts
           └─> HTTP GET /api/v1/groups
               └─> groupRoutes.js receives request
                   └─> groupController.getUserGroups() called
                       └─> groupService.getUserGroups() executes
                           └─> Queries Group.find({ members: userId })
                               └─> MongoDB returns groups
                                   └─> Service formats data
                                       └─> Controller sends response
                                           └─> API client receives JSON
                                               └─> Hook updates state
                                                   └─> Component re-renders with data

Result: Dashboard shows your groups! 🎉
```

**Code Trace:**

```typescript
// 1. Component uses hook
const { groups, isLoading } = useGroups();

// 2. Hook calls API
const fetchGroups = async () => {
  const groups = await apiGetUserGroups(); // From api.ts
  setGroups(groups);
};

// 3. API function makes HTTP request
export const getUserGroups = async () => {
  const response = await fetchWithAuth('/groups');
  return response.json();
};

// 4. Backend route
router.get('/', authMiddleware, GroupController.getUserGroups);

// 5. Controller delegates to service
const groups = await GroupService.getUserGroups(req.userId);

// 6. Service queries database
const groups = await Group.find({ members: userId })
  .populate('createdBy')
  .populate('members');

// 7. Data flows back up the chain
return groups; // Service
res.json({ success: true, groups }); // Controller
// ... back to frontend
```

### Example 2: Sharing a Song

**User Action:** Shares a Spotify track to a group

**Flow:**
```
1. User clicks "Share" button
   └─> GroupFeedScreen calls shareTrack(spotifyTrackId)
       └─> Hook useGroupFeed().shareTrack() runs
           └─> Calls shareSong(groupId, spotifyTrackId) from api.ts
               └─> HTTP POST /api/v1/shares
                   └─> shareRoutes.js receives request
                       └─> Validates input with Joi
                           └─> shareController.shareSong() called
                               └─> shareService.shareSong() executes
                                   ├─> Verifies user is in group
                                   ├─> Fetches track from Spotify API
                                   ├─> Creates Share document in MongoDB
                                   └─> Emits Socket.io event (future)
                                       └─> Returns populated share
                                           └─> Controller sends response
                                               └─> Hook updates local state
                                                   └─> Component shows new share

Result: Track appears in group feed instantly! ⚡
```

### Example 3: Viewing Analytics

**User Action:** Opens analytics page

**Flow:**
```
1. AnalyticsScreen renders
   └─> useGroupAnalytics(groupId) hook runs
       └─> Calls getGroupStats(groupId) from api.ts
           └─> HTTP GET /api/v1/analytics/:groupId/stats
               └─> analyticsRoutes.js receives request
                   └─> analyticsController.getGroupStats() called
                       └─> analyticsService.getGroupStats() executes
                           ├─> Fetches all shares for group
                           ├─> Calculates top sharer
                           ├─> Calculates genre pioneer
                           ├─> Calculates speed listener
                           └─> Calculates overall stats
                               └─> Returns stats object
                                   └─> Controller sends response
                                       └─> Hook updates state
                                           └─> Component displays stats

Result: See who's winning the competition! 🏆
```

---

## 🎨 Frontend Structure

### 1. Components (`src/components/`)

**What they do:** Render UI and handle user interactions

**Example: DashboardScreen.tsx**
```typescript
export default function DashboardScreen({ onNavigate }) {
  // Use custom hook to get data
  const { groups, isLoading, error } = useGroups();

  // Component only handles rendering
  return (
    <div>
      {isLoading && <Skeleton />}
      {error && <ErrorMessage />}
      {groups.map(group => <GroupCard group={group} />)}
    </div>
  );
}
```

**Key Components:**
- `DashboardScreen` - Shows all groups
- `GroupFeedScreen` - Shows tracks in a group
- `AnalyticsScreen` - Shows competition stats
- `ProfileScreen` - Shows user stats
- `LoginScreen` - Spotify OAuth login

### 2. Custom Hooks (`src/hooks/`)

**What they do:** Manage state and API calls (reusable logic)

**Example: useGroups.ts**
```typescript
export const useGroups = () => {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await apiGetUserGroups();
        setGroups(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // Return data and functions
  return { groups, isLoading, error };
};
```

**Why hooks?**
- Reusable: Multiple components can use same hook
- Testable: Easy to test separately
- Clean: Keeps components simple

**Available Hooks:**
- `useGroups()` - Manage groups (create, join, leave)
- `useGroupFeed(groupId)` - Manage shares in a group
- `useSpotifySearch()` - Search Spotify tracks
- `useGroupAnalytics(groupId)` - Get competition stats
- `useUserStats()` - Get user statistics

### 3. API Client (`src/lib/api.ts`)

**What it does:** Makes HTTP requests to backend

**Example:**
```typescript
export const getUserGroups = async () => {
  const response = await fetchWithAuth('/groups');
  const data = await response.json();
  return data.groups;
};

// fetchWithAuth automatically adds JWT token
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = getToken(); // From localStorage
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    throw new Error('Request failed');
  }
  
  return response;
};
```

**All API Functions:**
- Group: `getUserGroups()`, `createGroup()`, `joinGroup()`, `leaveGroup()`
- Share: `shareSong()`, `getGroupFeed()`, `markAsListened()`
- Spotify: `searchSpotifyTracks()`, `getRecentlyPlayed()`
- Analytics: `getGroupStats()`
- User: `getUserStats()`, `updateUserProfile()`

### 4. Types (`src/types/index.ts`)

**What they do:** Define TypeScript interfaces (type safety)

**Example:**
```typescript
export interface Group {
  _id: string;
  name: string;
  description: string;
  members: User[];
  createdBy: User;
  inviteCode: string;
  createdAt: string;
}

export interface Share {
  _id: string;
  group: string;
  sharedBy: User;
  trackName: string;
  artistName: string;
  listenCount: number;
  listeners: Listener[];
}
```

**Why TypeScript?**
- Catches bugs early
- Better autocomplete
- Easier refactoring
- Self-documenting code

---

## 🔧 Backend Structure

### 1. Routes (`src/routes/`)

**What they do:** Map URLs to controller functions

**Example: groupRoutes.js**
```javascript
const router = express.Router();

// GET /api/v1/groups - Get all user's groups
router.get('/', authMiddleware, GroupController.getUserGroups);

// POST /api/v1/groups - Create new group
router.post('/', 
  authMiddleware, 
  validate(createGroupSchema, 'body'),
  GroupController.createGroup
);

// POST /api/v1/groups/:id/leave - Leave group
router.post('/:id/leave',
  authMiddleware,
  validate(groupIdSchema, 'params'),
  GroupController.leaveGroup
);
```

**Key Routes:**
- `/api/v1/auth/*` - Authentication (login, callback, logout)
- `/api/v1/groups/*` - Group management
- `/api/v1/shares/*` - Song sharing
- `/api/v1/analytics/*` - Statistics
- `/api/v1/users/*` - User profile
- `/api/v1/spotify/*` - Spotify integration

### 2. Controllers (`src/controllers/`)

**What they do:** Handle HTTP requests/responses (thin layer)

**Example: groupController.js**
```javascript
class GroupController {
  static async createGroup(req, res, next) {
    try {
      const { name, description } = req.body;
      
      // Delegate to service
      const group = await GroupService.createGroup(
        req.userId, 
        name, 
        description
      );

      // Send response
      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        group
      });
    } catch (error) {
      // Pass errors to error middleware
      next(error);
    }
  }
}
```

**Controller Rules:**
- NO business logic (that's for services)
- Extract request data
- Call service methods
- Format responses
- Handle errors with try/catch

### 3. Services (`src/services/`)

**What they do:** ALL business logic and database queries

**Example: groupService.js**
```javascript
class GroupService {
  static async createGroup(userId, name, description) {
    // Validation
    if (!name || name.trim().length === 0) {
      const error = new Error('Group name is required');
      error.statusCode = 400;
      throw error;
    }

    // Generate invite code
    const inviteCode = crypto.randomBytes(8)
      .toString('hex')
      .toUpperCase();

    // Create group
    const group = new Group({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: userId,
      inviteCode,
      members: [userId]
    });

    await group.save();

    // Update user's groups
    await User.findByIdAndUpdate(userId, {
      $push: { groups: group._id }
    });

    // Return populated group
    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'displayName profileImage')
      .populate('members', 'displayName profileImage');

    return populatedGroup;
  }
}
```

**Service Rules:**
- Contains ALL business logic
- Performs database operations
- Calls external APIs (Spotify)
- Returns data or throws errors
- Reusable across multiple controllers

### 4. Models (`src/models/`)

**What they do:** Define database schema

**Example: Group.js**
```javascript
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    unique: true,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Indexes for performance
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ members: 1 });

module.exports = mongoose.model('Group', groupSchema);
```

### 5. Middleware (`src/middleware/`)

**What they do:** Process requests before controllers

**Example: authMiddleware.js**
```javascript
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID to request
    req.userId = decoded.userId;
    
    // Continue to controller
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};
```

**Key Middleware:**
- `authMiddleware` - Verify JWT token
- `errorMiddleware` - Centralized error handling
- `validate` - Joi input validation

---

## 🎯 Key Features Explained

### Feature 1: User Authentication (Spotify OAuth)

**Frontend Flow:**
```typescript
// 1. User clicks "Login with Spotify"
<Button onClick={handleLogin}>Login</Button>

// 2. Redirects to backend
const handleLogin = () => {
  window.location.href = 'http://127.0.0.1:5001/api/v1/auth/login';
};

// 3. Backend redirects to Spotify
// 4. Spotify redirects back to backend callback
// 5. Backend creates JWT and redirects to frontend with token
// 6. Frontend callback extracts token and saves it

// AuthCallbackScreen.tsx
const token = urlParams.get('token');
await login(token); // Saves to localStorage
onNavigate('dashboard'); // Go to dashboard
```

**Backend Flow:**
```javascript
// 1. Login endpoint redirects to Spotify
router.get('/login', (req, res) => {
  const authUrl = `https://accounts.spotify.com/authorize?${params}`;
  res.redirect(authUrl);
});

// 2. Callback receives code from Spotify
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  // Exchange code for access token
  const tokens = await getSpotifyTokens(code);
  
  // Get user profile
  const profile = await getSpotifyProfile(tokens.access_token);
  
  // Create or update user in database
  const user = await User.findOneAndUpdate(
    { spotifyId: profile.id },
    { ...userData },
    { upsert: true, new: true }
  );
  
  // Create JWT
  const jwt = createToken({ userId: user._id });
  
  // Redirect to frontend with token
  res.redirect(`${FRONTEND_URL}/?token=${jwt}`);
});
```

### Feature 2: Creating a Group

**Complete Flow:**

```
Frontend:
1. User fills form (name, description)
2. Clicks "Create Group"
3. useGroups().createGroup({ name, description })
4. API POST /api/v1/groups with body

Backend:
5. Route receives request
6. authMiddleware verifies JWT → req.userId
7. Joi validates input
8. Controller extracts data
9. Service creates group:
   - Generates invite code
   - Creates Group document
   - Adds user to members
   - Updates User document
10. Returns populated group

Frontend:
11. Hook receives response
12. Adds group to local state
13. Shows success toast
14. Component re-renders with new group
```

### Feature 3: Group Feed & Sharing

**Viewing Feed:**
```typescript
// Component
const { shares, isLoading } = useGroupFeed(groupId);

// Hook fetches on mount
useEffect(() => {
  const fetchFeed = async () => {
    const data = await getGroupFeed(groupId, 50, 0);
    setShares(data.shares);
  };
  fetchFeed();
}, [groupId]);

// Backend service
static async getGroupFeed(groupId, userId, limit, offset) {
  // Verify user is member
  const group = await Group.findOne({ _id: groupId, members: userId });
  
  // Get shares with pagination
  const shares = await Share.find({ group: groupId })
    .populate('sharedBy')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
    
  return { shares, total, limit, offset };
}
```

**Sharing a Song:**
```javascript
// Service fetches from Spotify
static async shareSong(userId, groupId, spotifyTrackId) {
  // 1. Verify user is in group
  const group = await Group.findOne({ _id: groupId, members: userId });
  
  // 2. Get Spotify access token
  const accessToken = await TokenManager.getValidAccessToken(userId);
  
  // 3. Fetch track details from Spotify API
  const trackData = await SpotifyService.getTrackDetails(
    accessToken, 
    spotifyTrackId
  );
  
  // 4. Create share
  const share = new Share({
    group: groupId,
    sharedBy: userId,
    spotifyTrackId: trackData.id,
    trackName: trackData.name,
    artistName: trackData.artists.map(a => a.name).join(', '),
    albumName: trackData.album.name,
    trackImage: trackData.album.images?.[0]?.url,
    // ... more track info
  });
  
  await share.save();
  
  // 5. Emit Socket.io event (future)
  io.to(groupId).emit('songShared', { share });
  
  return share;
}
```

### Feature 4: Analytics & Competition

**Backend Calculation:**
```javascript
static async getGroupStats(groupId, userId) {
  // 1. Verify access
  const group = await Group.findOne({ _id: groupId, members: userId });
  
  // 2. Get all shares
  const shares = await Share.find({ group: groupId })
    .populate('sharedBy');
  
  // 3. Calculate top sharer
  const shareCounts = {};
  shares.forEach(share => {
    const sharerId = share.sharedBy._id.toString();
    shareCounts[sharerId] = (shareCounts[sharerId] || 0) + 1;
  });
  
  let topSharer = null;
  let maxShares = 0;
  for (const sharerId in shareCounts) {
    if (shareCounts[sharerId] > maxShares) {
      maxShares = shareCounts[sharerId];
      topSharer = shares.find(s => 
        s.sharedBy._id.toString() === sharerId
      )?.sharedBy;
    }
  }
  
  // 4. Calculate genre pioneer (first to share each genre)
  // 5. Calculate speed listener (fastest to listen)
  // 6. Calculate overall stats
  
  return { topSharer, topGenrePioneer, speedListener, overall };
}
```

---

## 📖 Learning Path

### Step 1: Start with a Simple Feature (5 minutes)

**Trace "View Dashboard Groups":**

1. Open `Groupify-frontend/src/components/DashboardScreen.tsx`
   - Line 17: See `useGroups()` hook being called
   
2. Open `Groupify-frontend/src/hooks/useGroups.ts`
   - Line 13-24: See `fetchGroups()` function
   - Line 15: Calls `apiGetUserGroups()`
   
3. Open `Groupify-frontend/src/lib/api.ts`
   - Line 172: See `getUserGroups()` function
   - Line 173: Makes GET request to `/groups`
   
4. Open `Groupify-backend/src/routes/groupRoutes.js`
   - Line 11: Route maps to `GroupController.getUserGroups`
   
5. Open `Groupify-backend/src/controllers/groupController.js`
   - Line 13: Calls `GroupService.getUserGroups()`
   
6. Open `Groupify-backend/src/services/groupService.js`
   - Line 45: Queries database for groups

**You just traced a complete request!** 🎉

### Step 2: Understand State Management (10 minutes)

Pick one hook and understand it fully:

**Read `useGroups.ts` line by line:**
1. Lines 1-11: Imports
2. Lines 13-16: State variables (groups, loading, error)
3. Lines 18-30: `fetchGroups` - How data is loaded
4. Lines 32-44: `createGroup` - How new groups are created
5. Lines 71-73: `useEffect` - Runs on component mount
6. Lines 75-82: Return values - What component gets

**Key Concepts:**
- `useState`: Stores data
- `useEffect`: Runs side effects (API calls)
- `useCallback`: Memoizes functions
- Try/catch: Error handling
- Toast: User feedback

### Step 3: Follow Data Transformations (15 minutes)

**Track how data changes shape:**

```
Database (MongoDB):
{
  _id: ObjectId("..."),
  name: "My Group",
  members: [ObjectId("..."), ObjectId("...")],
  createdBy: ObjectId("...")
}

Backend Service (after .populate()):
{
  _id: "507f1f77bcf86cd799439011",
  name: "My Group",
  members: [
    { _id: "...", displayName: "User 1", profileImage: "..." },
    { _id: "...", displayName: "User 2", profileImage: "..." }
  ],
  createdBy: { _id: "...", displayName: "Creator", ... }
}

Backend Controller:
{
  success: true,
  groups: [{ ... }]
}

Frontend API Client:
return data.groups.map(group => ({
  ...group,
  id: group._id  // Add convenience id field
}))

Frontend Hook:
setGroups(fetchedGroups)

Frontend Component:
groups.map(group => <GroupCard group={group} />)
```

### Step 4: Add Console Logs (Debugging)

**Learn by watching:**

```typescript
// In useGroups.ts
const fetchGroups = async () => {
  console.log('🔍 Fetching groups...');
  try {
    const fetchedGroups = await apiGetUserGroups();
    console.log('✅ Fetched groups:', fetchedGroups);
    setGroups(fetchedGroups);
  } catch (err) {
    console.error('❌ Error fetching groups:', err);
  }
};
```

```javascript
// In groupService.js
static async getUserGroups(userId) {
  console.log('🔍 Service: Getting groups for user', userId);
  
  const groups = await Group.find({ members: userId })
    .populate('createdBy')
    .populate('members');
    
  console.log('✅ Service: Found', groups.length, 'groups');
  return groups;
}
```

**Open browser DevTools and watch the flow!**

### Step 5: Experiment (30 minutes)

**Try these modifications:**

1. **Add a field to Group:**
   ```javascript
   // Backend: models/Group.js
   tags: [{ type: String }]
   
   // Frontend: types/index.ts
   tags: string[];
   
   // Frontend: DashboardScreen.tsx
   <Badge>{group.tags?.join(', ')}</Badge>
   ```

2. **Add a new API function:**
   ```typescript
   // lib/api.ts
   export const getGroupByInviteCode = async (code: string) => {
     const response = await fetchWithAuth(`/groups/invite/${code}`);
     return response.json();
   };
   ```

3. **Create a custom hook:**
   ```typescript
   // hooks/useGroup.ts (singular)
   export const useGroup = (groupId: string) => {
     const [group, setGroup] = useState(null);
     // ... fetch single group
     return { group, isLoading, error };
   };
   ```

### Step 6: Read Documentation (Ongoing)

**Key Resources:**

1. **React Hooks:** https://react.dev/reference/react
2. **TypeScript:** https://www.typescriptlang.org/docs/
3. **Express.js:** https://expressjs.com/
4. **Mongoose:** https://mongoosejs.com/docs/
5. **Spotify API:** https://developer.spotify.com/documentation/web-api

---

## 🔑 Key Concepts to Master

### 1. **Separation of Concerns**
Each layer has ONE job:
- Components: Render UI
- Hooks: Manage state
- API Client: HTTP requests
- Controllers: Handle requests
- Services: Business logic
- Models: Data structure

### 2. **Data Flow**
Always flows in one direction:
```
User Input → Component → Hook → API → Backend → Database
Database → Backend → API → Hook → Component → UI Update
```

### 3. **State Management**
```typescript
// Component state (local)
const [count, setCount] = useState(0);

// Context state (global)
const { user } = useUser();

// Server state (from API)
const { groups } = useGroups();
```

### 4. **Async Operations**
```typescript
// Always use async/await
const fetchData = async () => {
  try {
    const data = await apiCall();
    setState(data);
  } catch (error) {
    setError(error);
  } finally {
    setLoading(false);
  }
};
```

### 5. **Error Handling**
```javascript
// Backend: Throw errors with status codes
const error = new Error('Not found');
error.statusCode = 404;
throw error;

// Frontend: Catch and display
try {
  await apiCall();
} catch (error) {
  toast.error(error.message);
}
```

---

## 🎓 Quick Reference

### Debug Checklist

**Frontend not updating?**
1. Check browser console for errors
2. Check Network tab for failed requests
3. Add `console.log` in hook
4. Verify state is being set

**Backend error?**
1. Check terminal for error logs
2. Add `console.log` in service
3. Check MongoDB Compass for data
4. Verify JWT token is valid

**API not working?**
1. Check backend is running
2. Check endpoint URL is correct
3. Check request body/params
4. Check authentication token

### File Navigation

**Frontend:**
- Components: `src/components/*.tsx`
- Hooks: `src/hooks/*.ts`
- API: `src/lib/api.ts`
- Types: `src/types/index.ts`

**Backend:**
- Routes: `src/routes/*Routes.js`
- Controllers: `src/controllers/*Controller.js`
- Services: `src/services/*Service.js`
- Models: `src/models/*.js`

---

## 🚀 Next Steps

1. **Read this guide** thoroughly
2. **Trace one feature** end-to-end with code open
3. **Add console.logs** and watch the flow
4. **Make small changes** and see what happens
5. **Ask questions** when stuck!

**Remember:** The best way to learn is by doing. Pick a feature, trace it, modify it, break it, fix it. That's how you truly understand! 💪

Good luck! 🎉


