# Groupify Authentication Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication Flow Diagram](#authentication-flow-diagram)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Token Management](#token-management)
6. [Component Deep Dive](#component-deep-dive)
7. [Security Considerations](#security-considerations)
8. [Testing & Troubleshooting](#testing--troubleshooting)

---

## Overview

Groupify uses **Spotify OAuth 2.0 Authorization Code Flow** combined with **JWT (JSON Web Tokens)** for user authentication. This hybrid approach allows:

- **Spotify OAuth**: Authenticates users with Spotify and grants access to their Spotify data
- **JWT**: Manages user sessions in the Groupify app without requiring repeated Spotify authentication

### Key Technologies
- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + TypeScript + Context API
- **Authentication**: Spotify OAuth 2.0 + JWT
- **Token Storage**: MongoDB (Spotify tokens) + localStorage (JWT)

---

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE LOGIN FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

USER                FRONTEND              BACKEND              SPOTIFY
 │                     │                     │                     │
 │  1. Clicks Login    │                     │                     │
 │────────────────────>│                     │                     │
 │                     │                     │                     │
 │                     │  2. GET /auth/login │                     │
 │                     │────────────────────>│                     │
 │                     │                     │                     │
 │                     │  3. Redirect URL    │                     │
 │                     │<────────────────────│                     │
 │                     │                     │                     │
 │  4. Redirect to Spotify Authorization     │                     │
 │─────────────────────────────────────────────────────────────────>│
 │                     │                     │                     │
 │  5. User Authorizes │                     │                     │
 │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                     │
 │                     │                     │                     │
 │  6. Redirect with code                    │                     │
 │<──────────────────────────────────────────────────────────────────│
 │                     │                     │                     │
 │  http://127.0.0.1:5001/api/v1/auth/callback?code=XXXXX          │
 │─────────────────────────────────────────>│                     │
 │                     │                     │                     │
 │                     │                     │  7. Exchange code   │
 │                     │                     │    for tokens       │
 │                     │                     │────────────────────>│
 │                     │                     │                     │
 │                     │                     │  8. Tokens returned │
 │                     │                     │<────────────────────│
 │                     │                     │  {                  │
 │                     │                     │    access_token,    │
 │                     │                     │    refresh_token,   │
 │                     │                     │    expires_in       │
 │                     │                     │  }                  │
 │                     │                     │                     │
 │                     │                     │  9. Fetch user info │
 │                     │                     │────────────────────>│
 │                     │                     │<────────────────────│
 │                     │                     │  {                  │
 │                     │                     │    id,              │
 │                     │                     │    display_name,    │
 │                     │                     │    email,           │
 │                     │                     │    images           │
 │                     │                     │  }                  │
 │                     │                     │                     │
 │                     │                     │ 10. Save to MongoDB │
 │                     │                     │  - Spotify tokens   │
 │                     │                     │  - User profile     │
 │                     │                     │  - Token expiry     │
 │                     │                     │                     │
 │                     │                     │ 11. Generate JWT    │
 │                     │                     │  {                  │
 │                     │                     │    userId: dbId,    │
 │                     │                     │    exp: 7days       │
 │                     │                     │  }                  │
 │                     │                     │                     │
 │  12. Redirect to frontend with JWT        │                     │
 │<──────────────────────────────────────────│                     │
 │  http://127.0.0.1:3000/auth/callback?token=JWT_TOKEN            │
 │                     │                     │                     │
 │                     │ 13. Extract JWT     │                     │
 │                     │    from URL         │                     │
 │                     │                     │                     │
 │                     │ 14. Store JWT       │                     │
 │                     │    localStorage     │                     │
 │                     │                     │                     │
 │                     │ 15. GET /auth/me    │                     │
 │                     │    (with JWT)       │                     │
 │                     │────────────────────>│                     │
 │                     │                     │ 16. Verify JWT      │
 │                     │                     │                     │
 │                     │ 17. User data       │                     │
 │                     │<────────────────────│                     │
 │                     │  {                  │                     │
 │                     │    _id,             │                     │
 │                     │    spotifyId,       │                     │
 │                     │    displayName,     │                     │
 │                     │    email,           │                     │
 │                     │    profileImage,    │                     │
 │                     │    groups           │                     │
 │                     │  }                  │                     │
 │                     │                     │                     │
 │                     │ 18. Update Context  │                     │
 │                     │    - Set user       │                     │
 │                     │    - Set token      │                     │
 │                     │                     │                     │
 │  19. Show Dashboard │                     │                     │
 │<────────────────────│                     │                     │
 │                     │                     │                     │

┌─────────────────────────────────────────────────────────────────────────┐
│                          LOGOUT FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

USER                FRONTEND              BACKEND
 │                     │                     │
 │  1. Clicks Logout   │                     │
 │────────────────────>│                     │
 │                     │                     │
 │                     │  2. POST /auth/logout (with JWT)
 │                     │────────────────────>│
 │                     │                     │
 │                     │                     │ 3. Verify JWT
 │                     │                     │ 4. Log event
 │                     │                     │
 │                     │  5. Success response│
 │                     │<────────────────────│
 │                     │                     │
 │                     │  6. Remove JWT      │
 │                     │     from localStorage
 │                     │                     │
 │                     │  7. Clear Context   │
 │                     │     - user = null   │
 │                     │     - token = null  │
 │                     │                     │
 │  8. Show Login      │                     │
 │<────────────────────│                     │
 │                     │                     │
```

---

## Backend Architecture

### File Structure

```
Groupify-backend/src/
├── controllers/
│   └── authController.js       # Handles auth logic
├── routes/
│   └── authRoutes.js           # Defines auth endpoints
├── models/
│   └── User.js                 # User schema
├── middleware/
│   └── authMiddleware.js       # JWT verification
├── services/
│   └── spotifyService.js       # Spotify API calls
├── utils/
│   └── tokenManager.js         # Token refresh logic
└── config/
    └── spotify.js              # Spotify config
```

---

### 1. **authController.js** - The Brain of Authentication

**Location:** `Groupify-backend/src/controllers/authController.js`

#### **Method 1: `login()` - Initiate OAuth**
```javascript
static async login(req, res) {
  // Generates Spotify authorization URL
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code` +
    `&client_id=${SPOTIFY_CLIENT_ID}` +
    `&redirect_uri=${SPOTIFY_REDIRECT_URI}` +
    `&scope=${SPOTIFY_SCOPES}`;
  
  // Redirects user to Spotify login page
  res.redirect(authUrl);
}
```

**What happens:**
1. User clicks "Login with Spotify"
2. Frontend calls `GET /api/v1/auth/login`
3. Backend redirects browser to Spotify's authorization page
4. User sees Spotify's "Authorize Groupify" screen

**Scopes requested:**
- `user-read-email` - Access user's email
- `user-read-private` - Access user's profile
- `playlist-read-private` - Read user's playlists
- `playlist-modify-public` - Modify user's public playlists
- `playlist-modify-private` - Modify user's private playlists

---

#### **Method 2: `callback()` - Exchange Code for Tokens**
```javascript
static async callback(req, res) {
  const { code } = req.query;
  
  // 1. Exchange authorization code for tokens
  const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET
  });
  
  const { access_token, refresh_token, expires_in } = tokenResponse.data;
  
  // 2. Use access token to fetch user profile from Spotify
  const userProfile = await axios.get('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  const { id, display_name, email, images } = userProfile.data;
  
  // 3. Find or create user in MongoDB
  let user = await User.findOne({ spotifyId: id });
  
  if (!user) {
    user = await User.create({
      spotifyId: id,
      displayName: display_name,
      email: email,
      profileImage: images[0]?.url,
      spotifyAccessToken: access_token,
      spotifyRefreshToken: refresh_token,
      spotifyTokenExpires: Date.now() + (expires_in * 1000)
    });
  } else {
    // Update existing user's tokens
    user.spotifyAccessToken = access_token;
    user.spotifyRefreshToken = refresh_token;
    user.spotifyTokenExpires = Date.now() + (expires_in * 1000);
    await user.save();
  }
  
  // 4. Generate JWT for Groupify session
  const jwtToken = jwt.sign(
    { userId: user._id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // 5. Redirect to frontend with JWT
  res.redirect(`${FRONTEND_URL}/auth/callback?token=${jwtToken}`);
}
```

**What happens:**
1. Spotify redirects back with authorization code
2. Backend exchanges code for access + refresh tokens
3. Backend fetches user profile from Spotify API
4. Backend saves/updates user in MongoDB with tokens
5. Backend generates JWT for app session
6. Backend redirects to frontend with JWT in URL

**Key Points:**
- **Spotify tokens** are stored in MongoDB (server-side)
- **JWT** is sent to frontend (client-side)
- JWT only contains `userId`, not sensitive Spotify tokens

---

#### **Method 3: `getCurrentUser()` - Get Logged-in User**
```javascript
static async getCurrentUser(req, res) {
  // req.userId comes from authMiddleware after JWT verification
  const user = await User.findById(req.userId)
    .populate('groups', 'name description createdAt')
    .select('-spotifyAccessToken -spotifyRefreshToken'); // Exclude sensitive tokens
  
  res.json({
    success: true,
    user
  });
}
```

**What happens:**
1. Frontend calls `GET /api/v1/auth/me` with JWT in header
2. `authMiddleware` verifies JWT and extracts `userId`
3. Backend fetches user from MongoDB
4. Backend returns user data (without Spotify tokens)

**Security Note:**
- Spotify tokens are **never** sent to frontend
- Only safe user data is returned

---

#### **Method 4: `logout()` - Logout User**
```javascript
static async logout(req, res) {
  const userId = req.user.userId;
  
  // Log the logout event (for analytics/debugging)
  console.log(`[Auth] User ${userId} logged out at ${new Date().toISOString()}`);
  
  // TODO: Implement token blacklisting if needed
  // await TokenBlacklist.create({ token: req.token, expiresAt: req.tokenExp });
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}
```

**What happens:**
1. Frontend calls `POST /api/v1/auth/logout` with JWT
2. Backend logs the logout event
3. Backend responds with success
4. Frontend removes JWT from localStorage

**Note:** With JWT, logout is primarily **client-side** (removing the token). The backend endpoint is for:
- Logging/analytics
- Future token blacklisting implementation
- Server-side session invalidation (if needed)

---

### 2. **authMiddleware.js** - JWT Verification

**Location:** `Groupify-backend/src/middleware/authMiddleware.js`

```javascript
const authMiddleware = (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1]; // "Bearer TOKEN" -> "TOKEN"
    
    // 2. Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. Attach userId to request object
    req.userId = decoded.userId;
    req.user = decoded; // Full decoded payload
    
    // 4. Continue to next middleware/controller
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};
```

**Usage:**
```javascript
// Protect routes by adding authMiddleware
router.get('/me', authMiddleware, AuthController.getCurrentUser);
router.post('/logout', authMiddleware, AuthController.logout);
```

**What it does:**
1. Extracts JWT from `Authorization: Bearer <token>` header
2. Verifies JWT signature using `JWT_SECRET`
3. Checks if token is expired
4. Attaches `userId` to `req` object for use in controllers
5. Rejects request if token is invalid/expired

---

### 3. **User Model** - MongoDB Schema

**Location:** `Groupify-backend/src/models/User.js`

```javascript
const userSchema = new Schema({
  spotifyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    sparse: true  // Allow null, but enforce uniqueness when present
  },
  profileImage: {
    type: String,
    default: null
  },
  spotifyAccessToken: {
    type: String,
    required: true,
    select: false  // Never include in queries by default
  },
  spotifyRefreshToken: {
    type: String,
    required: true,
    select: false  // Never include in queries by default
  },
  spotifyTokenExpires: {
    type: Date,
    required: true
  },
  groups: [{
    type: Schema.Types.ObjectId,
    ref: 'Group'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true  // Adds createdAt, updatedAt
});
```

**Key Fields:**
- **spotifyId**: Unique Spotify user ID (e.g., "31abcd...")
- **displayName**: User's Spotify display name
- **email**: User's email (may be null if not shared)
- **profileImage**: URL to user's Spotify profile picture
- **spotifyAccessToken**: Spotify access token (short-lived, ~1 hour)
- **spotifyRefreshToken**: Spotify refresh token (long-lived)
- **spotifyTokenExpires**: When access token expires
- **groups**: Array of Group IDs user belongs to
- **isActive**: Account status flag

**Security:**
- Tokens have `select: false` - never included in queries unless explicitly requested
- Frontend never receives Spotify tokens

---

### 4. **spotifyService.js** - Spotify API Calls

**Location:** `Groupify-backend/src/services/spotifyService.js`

```javascript
class SpotifyService {
  /**
   * Make authenticated request to Spotify API
   * Automatically refreshes token if expired
   */
  static async makeSpotifyRequest(user, endpoint, method = 'GET', data = null) {
    try {
      // Check if token is expired
      if (Date.now() >= user.spotifyTokenExpires) {
        // Token expired, refresh it
        user = await this.refreshAccessToken(user);
      }
      
      // Make request with fresh token
      const response = await axios({
        method,
        url: `https://api.spotify.com/v1${endpoint}`,
        headers: {
          'Authorization': `Bearer ${user.spotifyAccessToken}`
        },
        data
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token invalid, try refreshing
        user = await this.refreshAccessToken(user);
        // Retry request
        return this.makeSpotifyRequest(user, endpoint, method, data);
      }
      throw error;
    }
  }
  
  /**
   * Refresh expired Spotify access token
   */
  static async refreshAccessToken(user) {
    const response = await axios.post('https://accounts.spotify.com/api/token', {
      grant_type: 'refresh_token',
      refresh_token: user.spotifyRefreshToken,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET
    });
    
    const { access_token, expires_in } = response.data;
    
    // Update user's token in database
    user.spotifyAccessToken = access_token;
    user.spotifyTokenExpires = Date.now() + (expires_in * 1000);
    await user.save();
    
    return user;
  }
}
```

**Usage:**
```javascript
// Get user's playlists
const playlists = await SpotifyService.makeSpotifyRequest(
  user,
  '/me/playlists',
  'GET'
);

// Create playlist
const newPlaylist = await SpotifyService.makeSpotifyRequest(
  user,
  '/me/playlists',
  'POST',
  {
    name: 'Groupify Playlist',
    description: 'Created by Groupify',
    public: false
  }
);
```

**Features:**
- Automatic token refresh when expired
- Retry logic for 401 errors
- Centralized Spotify API interaction

---

## Frontend Architecture

### File Structure

```
Groupify-frontend/src/
├── components/
│   ├── LoginScreen.tsx         # Login UI
│   ├── AuthCallbackScreen.tsx  # Handles OAuth callback
│   └── AppSidebar.tsx          # Shows user profile + logout
├── contexts/
│   └── UserContext.tsx         # Global auth state
├── lib/
│   ├── api.ts                  # API client
│   └── config.ts               # API base URL
├── types/
│   └── index.ts                # TypeScript interfaces
└── App.tsx                     # Main app component
```

---

### 1. **api.ts** - API Client & Auth Helpers

**Location:** `Groupify-frontend/src/lib/api.ts`

```typescript
const API_BASE_URL = 'http://127.0.0.1:5001/api/v1';

/**
 * Get JWT from localStorage
 */
export const getToken = (): string | null => {
  return localStorage.getItem('groupify_token');
};

/**
 * Save JWT to localStorage
 */
export const setToken = (token: string): void => {
  localStorage.setItem('groupify_token', token);
};

/**
 * Remove JWT from localStorage
 */
export const removeToken = (): void => {
  localStorage.removeItem('groupify_token');
};

/**
 * Make authenticated API request
 */
export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
};

/**
 * Get current user from backend
 */
export const getCurrentUser = async (): Promise<User> => {
  const data = await fetchWithAuth('/auth/me');
  return data.user;
};

/**
 * Initiate Spotify login (redirects to backend)
 */
export const login = (): void => {
  window.location.href = `${API_BASE_URL}/auth/login`;
};

/**
 * Logout user (call backend + remove token)
 */
export const logout = async (): Promise<void> => {
  try {
    // Call backend logout endpoint (for logging/analytics)
    await fetchWithAuth('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    // Ignore errors - logout should succeed even if backend call fails
    console.warn('Backend logout call failed:', error);
  } finally {
    // Always remove token client-side
    removeToken();
  }
};
```

**Key Functions:**
- **`getToken()`**: Retrieves JWT from `localStorage`
- **`setToken()`**: Saves JWT to `localStorage`
- **`removeToken()`**: Clears JWT from `localStorage`
- **`fetchWithAuth()`**: Makes API requests with JWT in header
- **`getCurrentUser()`**: Fetches user profile from `/auth/me`
- **`login()`**: Redirects to backend OAuth endpoint
- **`logout()`**: Calls backend logout + removes token

---

### 2. **UserContext.tsx** - Global Auth State

**Location:** `Groupify-frontend/src/contexts/UserContext.tsx`

```typescript
interface UserContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        setTokenState(storedToken);
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Failed to load user:', error);
          removeToken();
          setTokenState(null);
        }
      }
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  // Login: save token + fetch user
  const handleLogin = async (token: string) => {
    setToken(token);
    setTokenState(token);
    
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      removeToken();
      setTokenState(null);
      throw error;
    }
  };

  // Logout: clear token + user state
  const handleLogout = async () => {
    await apiLogout(); // Calls backend + removes token
    setTokenState(null);
    setUser(null);
    window.history.replaceState({}, document.title, '/'); // Clear URL
  };

  return (
    <UserContext.Provider value={{
      user,
      token: tokenState,
      isLoading,
      isAuthenticated: !!user && !!tokenState,
      login: handleLogin,
      logout: handleLogout,
    }}>
      {children}
    </UserContext.Provider>
  );
};

// Hook to use auth context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
```

**Features:**
- **Global state** for user + token
- **Auto-loads** user on app mount if token exists
- **`login()`**: Saves token + fetches user data
- **`logout()`**: Clears token + user state
- **`isAuthenticated`**: Boolean flag for easy auth checks
- **`isLoading`**: Prevents flash of wrong content

---

### 3. **LoginScreen.tsx** - Login UI

**Location:** `Groupify-frontend/src/components/LoginScreen.tsx`

```typescript
export default function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Groupify</CardTitle>
          <CardDescription>Connect with Spotify to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={login} // From api.ts
          >
            <Music className="mr-2 h-5 w-5" />
            Login with Spotify
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**What happens:**
1. User clicks "Login with Spotify"
2. `login()` redirects to `http://127.0.0.1:5001/api/v1/auth/login`
3. Backend redirects to Spotify authorization page

---

### 4. **AuthCallbackScreen.tsx** - Handle OAuth Callback

**Location:** `Groupify-frontend/src/components/AuthCallbackScreen.tsx`

```typescript
export default function AuthCallbackScreen({ onNavigate }: AuthCallbackScreenProps) {
  const { login } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. Parse URL for token or error
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const errorParam = params.get('error');

        if (errorParam) {
          const errorMsg = `Authentication failed: ${errorParam}`;
          setError(errorMsg);
          toast.error(errorMsg);
          setIsLoading(false);
          return;
        }

        if (!token) {
          const errorMsg = 'No authentication token received';
          setError(errorMsg);
          toast.error(errorMsg);
          setIsLoading(false);
          return;
        }

        // 2. Login with the token (saves to localStorage + fetches user)
        await login(token);

        // 3. Show success message
        toast.success("Successfully logged in with Spotify!");

        // 4. Clean URL (remove token from URL bar)
        window.history.replaceState({}, document.title, '/');

        // 5. Navigate to dashboard
        onNavigate('dashboard');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to complete authentication';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [login, onNavigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <Button onClick={() => onNavigate('login')}>Back to Login</Button>
      </div>
    );
  }

  return null;
}
```

**What happens:**
1. URL is `http://127.0.0.1:3000/auth/callback?token=JWT_TOKEN`
2. Extract `token` from URL query params
3. Call `login(token)` to save token + fetch user
4. Show success toast notification
5. Clean URL (remove token from address bar)
6. Navigate to dashboard

**Security:**
- Token is immediately removed from URL after extraction
- Prevents token from being visible in browser history

---

### 5. **AppSidebar.tsx** - User Profile & Logout

**Location:** `Groupify-frontend/src/components/AppSidebar.tsx`

```typescript
export default function AppSidebar({ currentScreen, onNavigate }: AppSidebarProps) {
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    onNavigate('login');
  };

  return (
    <div className="flex flex-col h-screen w-64 bg-surface border-r border-border">
      {/* User Profile Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.profileImage || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.displayName ? getInitials(user.displayName) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{user?.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">
              @{user?.spotifyId || 'user'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      {/* ... menu items ... */}

      {/* Logout Button */}
      <div className="mt-auto p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
```

**Features:**
- Displays user's Spotify profile image
- Shows display name and Spotify ID
- Logout button calls `logout()` from context
- Shows toast notification on logout

---

## Token Management

### Two Types of Tokens

| Token Type | Storage Location | Lifespan | Purpose | Managed By |
|------------|-----------------|----------|---------|------------|
| **Spotify Access Token** | MongoDB (backend) | ~1 hour | Access Spotify API | Backend (`spotifyService.js`) |
| **Spotify Refresh Token** | MongoDB (backend) | Long-lived | Refresh access token | Backend (`spotifyService.js`) |
| **JWT (Groupify Session)** | localStorage (frontend) | 7 days | Authenticate API requests | Frontend (`api.ts` + `UserContext`) |

---

### Token Lifecycle

#### **Spotify Tokens**

```
Login
  ↓
Authorization Code → Access Token (1 hour) + Refresh Token (long-lived)
  ↓
Stored in MongoDB (encrypted at rest)
  ↓
Used for Spotify API calls
  ↓
Expires after ~1 hour
  ↓
Backend automatically refreshes using Refresh Token
  ↓
New Access Token stored in MongoDB
```

**Refresh Logic:**
```javascript
// In spotifyService.js
if (Date.now() >= user.spotifyTokenExpires) {
  // Token expired, refresh it
  const response = await axios.post('https://accounts.spotify.com/api/token', {
    grant_type: 'refresh_token',
    refresh_token: user.spotifyRefreshToken,
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET
  });
  
  user.spotifyAccessToken = response.data.access_token;
  user.spotifyTokenExpires = Date.now() + (response.data.expires_in * 1000);
  await user.save();
}
```

**Key Points:**
- Frontend **never** sees Spotify tokens
- Backend handles all Spotify API calls
- Tokens automatically refresh when expired

---

#### **JWT (Groupify Session)**

```
Login Success
  ↓
Backend generates JWT: { userId: "xxx", exp: 7 days }
  ↓
Sent to frontend via URL: /auth/callback?token=JWT
  ↓
Frontend saves to localStorage
  ↓
Included in all API requests: Authorization: Bearer JWT
  ↓
Backend verifies JWT on protected endpoints
  ↓
Valid → Allow request
Invalid/Expired → 401 Unauthorized
```

**JWT Payload:**
```json
{
  "userId": "67890abcdef1234567890abc",
  "iat": 1730692800,  // Issued at (Unix timestamp)
  "exp": 1731297600   // Expires in 7 days
}
```

**Key Points:**
- Only contains `userId`, no sensitive data
- Signed with `JWT_SECRET` (prevents tampering)
- Expires after 7 days (user must re-login)
- Stateless (no server-side session storage needed)

---

### Security Best Practices

1. **Spotify tokens stay on backend**
   - Never sent to frontend
   - Encrypted at rest in MongoDB
   - Only backend can use them

2. **JWT in localStorage**
   - Safe for XSS-protected apps
   - Easier than cookies for SPA architecture
   - Cleared on logout

3. **HTTPS in production**
   - All tokens must be transmitted over HTTPS
   - Prevents man-in-the-middle attacks

4. **Token expiration**
   - Spotify access token: 1 hour (auto-refreshed)
   - JWT: 7 days (requires re-login)
   - Balance between security and UX

5. **Minimal JWT payload**
   - Only `userId`, no sensitive data
   - Reduces risk if token is compromised

---

## Component Deep Dive

### How Components Interact

```
┌─────────────────────────────────────────────────────────────┐
│                          App.tsx                            │
│  - Wraps everything in <UserProvider>                       │
│  - Handles top-level routing                                │
│  - Shows appropriate screen based on auth state             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ provides auth context
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      UserContext.tsx                        │
│  - Manages global auth state (user, token, isLoading)       │
│  - Provides login/logout functions                          │
│  - Auto-loads user on app mount                             │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ LoginScreen.tsx │  │ AuthCallback.tsx │  │ AppSidebar   │
│ - Shows login   │  │ - Handles OAuth  │  │ - Shows user │
│   button        │  │   callback       │  │   profile    │
│ - Calls login() │  │ - Extracts token │  │ - Logout btn │
└─────────────────┘  │ - Saves to state │  └──────────────┘
                     └──────────────────┘
```

---

### Authentication Flow Through Components

#### **1. Initial Page Load**

```typescript
// App.tsx
function App() {
  return (
    <UserProvider>  {/* 1. Wraps entire app */}
      <AppContent />
    </UserProvider>
  );
}

// UserContext.tsx - useEffect runs on mount
useEffect(() => {
  const initAuth = async () => {
    const storedToken = getToken(); // 2. Check localStorage for token
    if (storedToken) {
      setTokenState(storedToken);
      try {
        const userData = await getCurrentUser(); // 3. Fetch user from backend
        setUser(userData);  // 4. Set user in state
      } catch (error) {
        removeToken();  // 5. Invalid token, clear it
      }
    }
    setIsLoading(false);  // 6. Done loading
  };
  
  initAuth();
}, []);

// App.tsx - Conditional rendering
function AppContent() {
  const { isAuthenticated, isLoading } = useUser();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <LoginScreen />;  // 7. Show login if not authenticated
  }
  
  return <Dashboard />;  // 8. Show dashboard if authenticated
}
```

**Flow:**
1. App mounts → `UserProvider` initializes
2. `UserContext` checks localStorage for token
3. If token exists, calls `GET /api/v1/auth/me`
4. If successful, sets user in state → shows dashboard
5. If no token or invalid, shows login screen

---

#### **2. Login Flow**

```typescript
// LoginScreen.tsx
<Button onClick={login}>Login with Spotify</Button>

// api.ts
export const login = (): void => {
  window.location.href = 'http://127.0.0.1:5001/api/v1/auth/login';
};

// Backend redirects to Spotify
// User authorizes
// Spotify redirects back to backend
// Backend redirects to: http://127.0.0.1:3000/auth/callback?token=JWT

// App.tsx detects route change
useEffect(() => {
  if (window.location.pathname === '/auth/callback') {
    setCurrentScreen('auth-callback');
  }
}, []);

// AuthCallbackScreen.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');  // Extract JWT from URL
  
  await login(token);  // Save token + fetch user (from UserContext)
  
  window.history.replaceState({}, document.title, '/');  // Clean URL
  onNavigate('dashboard');  // Go to dashboard
}, []);
```

**Flow:**
1. User clicks "Login with Spotify"
2. Redirects to backend `/auth/login`
3. Backend redirects to Spotify
4. User authorizes on Spotify
5. Spotify redirects to backend `/auth/callback?code=XXX`
6. Backend exchanges code for tokens
7. Backend saves user + tokens in MongoDB
8. Backend generates JWT
9. Backend redirects to frontend `/auth/callback?token=JWT`
10. Frontend extracts JWT from URL
11. Frontend saves JWT to localStorage
12. Frontend fetches user data
13. Frontend navigates to dashboard

---

#### **3. Authenticated API Request**

```typescript
// Any component
const { user } = useUser();

// Making an API call
const response = await fetchWithAuth('/groups');

// api.ts - fetchWithAuth
export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();  // 1. Get JWT from localStorage
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,  // 2. Add JWT to header
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      removeToken();  // 3. Clear invalid token
      window.location.reload();  // 4. Reload app (will show login)
    }
    throw new Error('Request failed');
  }
  
  return response.json();
};

// Backend - authMiddleware
router.get('/groups', authMiddleware, GroupController.getGroups);

// authMiddleware.js
const authHeader = req.headers.authorization;  // 5. Extract token
const token = authHeader.split(' ')[1];  // "Bearer TOKEN" → "TOKEN"
const decoded = jwt.verify(token, JWT_SECRET);  // 6. Verify JWT
req.userId = decoded.userId;  // 7. Attach userId to request
next();  // 8. Continue to controller

// GroupController.js
static async getGroups(req, res) {
  const userId = req.userId;  // 9. Get userId from request
  const groups = await Group.find({ members: userId });  // 10. Query DB
  res.json({ groups });  // 11. Return data
}
```

**Flow:**
1. Frontend calls `fetchWithAuth('/groups')`
2. `fetchWithAuth` gets JWT from localStorage
3. Adds JWT to `Authorization: Bearer <token>` header
4. Backend receives request
5. `authMiddleware` extracts and verifies JWT
6. Attaches `userId` to request object
7. Controller uses `userId` to fetch data
8. Response sent back to frontend

---

#### **4. Logout Flow**

```typescript
// AppSidebar.tsx
<Button onClick={handleLogout}>Logout</Button>

const handleLogout = () => {
  logout();  // From UserContext
  toast.success("Logged out successfully");
  onNavigate('login');
};

// UserContext.tsx
const handleLogout = async () => {
  await apiLogout();  // Call backend + remove token
  setTokenState(null);  // Clear state
  setUser(null);
  window.history.replaceState({}, document.title, '/');  // Clean URL
};

// api.ts
export const logout = async (): Promise<void> => {
  try {
    await fetchWithAuth('/auth/logout', { method: 'POST' });  // Call backend
  } catch (error) {
    console.warn('Backend logout call failed:', error);  // Ignore errors
  } finally {
    removeToken();  // Always remove token
  }
};

// Backend - authController.js
static async logout(req, res) {
  const userId = req.user.userId;
  console.log(`[Auth] User ${userId} logged out`);  // Log event
  res.json({ success: true, message: 'Logged out successfully' });
}
```

**Flow:**
1. User clicks logout button
2. `logout()` from `UserContext` is called
3. Calls backend `POST /auth/logout` (for logging)
4. Removes JWT from localStorage
5. Clears user state in context
6. App re-renders → shows login screen

---

## Security Considerations

### 1. **XSS (Cross-Site Scripting) Protection**

**Risk:** Malicious scripts injected into the app could steal JWT from localStorage.

**Mitigation:**
- Use React (automatically escapes content)
- Never use `dangerouslySetInnerHTML` with user input
- Sanitize all user input
- Implement Content Security Policy (CSP) headers

**Example CSP:**
```javascript
// In backend (app.js)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  next();
});
```

---

### 2. **CSRF (Cross-Site Request Forgery) Protection**

**Risk:** Malicious sites making requests on behalf of logged-in users.

**Mitigation:**
- JWT in `Authorization` header (not cookies)
- CORS restrictions on backend
- SameSite cookie policy (if using cookies)

**Backend CORS config:**
```javascript
app.use(cors({
  origin: 'http://127.0.0.1:3000',  // Only allow frontend domain
  credentials: true
}));
```

---

### 3. **Token Storage**

**localStorage vs cookies:**

| Storage | Pros | Cons |
|---------|------|------|
| **localStorage** | ✅ Easy to use<br>✅ Works with SPAs<br>✅ No CSRF risk | ❌ Vulnerable to XSS<br>❌ Not httpOnly |
| **httpOnly cookies** | ✅ Not accessible to JS<br>✅ More secure against XSS | ❌ Requires CSRF protection<br>❌ Complex with SPAs |

**Choice:** localStorage (with XSS protection) is suitable for this SPA architecture.

---

### 4. **Token Expiration**

**Why tokens expire:**
- Limits damage if token is stolen
- Forces periodic re-authentication
- Allows revoking access

**Expiration times:**
- Spotify access token: **1 hour** (Spotify's default)
- JWT: **7 days** (balance between security and UX)

**Handling expired JWT:**
```typescript
// In fetchWithAuth (api.ts)
if (response.status === 401) {
  removeToken();
  window.location.reload();  // Reload → shows login screen
}
```

---

### 5. **Sensitive Data Handling**

**Never expose:**
- Spotify access/refresh tokens (keep on backend only)
- JWT secret (keep in `.env`, never commit)
- Spotify client secret (keep in `.env`, never commit)

**User model security:**
```javascript
// In User.js model
spotifyAccessToken: {
  type: String,
  required: true,
  select: false  // Never include in queries by default
},
spotifyRefreshToken: {
  type: String,
  required: true,
  select: false  // Never include in queries by default
}
```

**Controller security:**
```javascript
// In authController.js
const user = await User.findById(req.userId)
  .select('-spotifyAccessToken -spotifyRefreshToken');  // Exclude tokens
```

---

### 6. **Environment Variables**

**Never commit to Git:**
```bash
# .gitignore
.env
```

**Use `.env` file:**
```env
# Backend .env
PORT=5001
MONGO_URI=mongodb+srv://...
JWT_SECRET=super-secret-key-change-in-production
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5001/api/v1/auth/callback
FRONTEND_URL=http://127.0.0.1:3000
```

**Production secrets:**
- Use environment variable management (e.g., AWS Secrets Manager, Heroku Config Vars)
- Rotate secrets regularly
- Use strong, random values for `JWT_SECRET`

---

### 7. **HTTPS in Production**

**Development:**
- HTTP is acceptable for `localhost` / `127.0.0.1`

**Production:**
- **Must** use HTTPS
- Protects tokens in transit
- Required by Spotify for OAuth (production redirect URIs must be HTTPS)

**Setup:**
- Use services like Let's Encrypt for free SSL certificates
- Or deploy on platforms that provide HTTPS (Heroku, Vercel, Netlify)

---

## Testing & Troubleshooting

### Manual Testing Checklist

#### **1. Login Flow**

✅ **Test:** Click "Login with Spotify"
- **Expected:** Redirects to Spotify authorization page
- **Check:** URL is `https://accounts.spotify.com/authorize?...`

✅ **Test:** Authorize on Spotify
- **Expected:** Redirects to frontend with token in URL
- **Check:** URL is `http://127.0.0.1:3000/auth/callback?token=eyJ...`

✅ **Test:** Token extracted and saved
- **Expected:** URL cleans to `http://127.0.0.1:3000/`
- **Check:** `localStorage.getItem('groupify_token')` returns JWT
- **Check:** User data displayed in sidebar

✅ **Test:** Success toast shown
- **Expected:** "Successfully logged in with Spotify!" appears

---

#### **2. Authenticated Requests**

✅ **Test:** Fetch user profile
```bash
curl -X GET http://127.0.0.1:5001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
- **Expected:** Returns user data (no Spotify tokens)

✅ **Test:** Protected endpoint without token
```bash
curl -X GET http://127.0.0.1:5001/api/v1/auth/me
```
- **Expected:** 401 Unauthorized

---

#### **3. Token Refresh**

✅ **Test:** Wait for Spotify token to expire (1 hour)
- **Expected:** Backend automatically refreshes token on next Spotify API call
- **Check:** Backend logs show token refresh

---

#### **4. Logout Flow**

✅ **Test:** Click logout button
- **Expected:** Redirects to login screen
- **Check:** `localStorage.getItem('groupify_token')` returns `null`
- **Check:** Success toast: "Logged out successfully"
- **Check:** Backend logs: `[Auth] User xxx logged out`

---

### Common Issues & Solutions

#### **Issue 1: "INVALID_CLIENT: Invalid redirect URI"**

**Cause:** Redirect URI in code doesn't match Spotify dashboard exactly.

**Solution:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Check Redirect URIs in your app settings
3. Ensure exact match in `.env`:
```env
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5001/api/v1/auth/callback
```
4. Note: `localhost` and `127.0.0.1` are different to Spotify

---

#### **Issue 2: "Frontend not loading at http://127.0.0.1:3000"**

**Cause:** Vite binding to IPv6 `::1` instead of IPv4 `127.0.0.1`.

**Solution:** Explicitly set host in `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    host: '127.0.0.1',  // Force IPv4
    port: 3000,
    open: true,
  },
});
```

---

#### **Issue 3: "Error: listen EADDRINUSE: address already in use"**

**Cause:** Process already running on that port.

**Solution:**
```bash
# Kill process on port 5001 (backend)
lsof -ti:5001 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

---

#### **Issue 4: "JWT token expired"**

**Cause:** JWT is valid for 7 days, then expires.

**Solution:**
- User must log in again
- Frontend automatically detects 401 and clears token
- Shows login screen

**To extend JWT lifetime:**
```javascript
// In authController.js - callback()
const jwtToken = jwt.sign(
  { userId: user._id },
  JWT_SECRET,
  { expiresIn: '30d' }  // Change from '7d' to '30d'
);
```

---

#### **Issue 5: "User data not showing in sidebar"**

**Cause:** `user` is `null` in `UserContext`.

**Debug:**
1. Check localStorage:
```javascript
console.log(localStorage.getItem('groupify_token'));
```

2. Check API response:
```bash
curl -X GET http://127.0.0.1:5001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Check React DevTools → Components → UserContext → `user` state

**Common causes:**
- Token is invalid/expired
- Backend `/auth/me` endpoint failing
- Network error

---

### Debug Logging

#### **Backend**

```javascript
// In authController.js
console.log('[Auth] Login initiated');
console.log('[Auth] Callback received, code:', code);
console.log('[Auth] User created/updated:', user._id);
console.log('[Auth] JWT generated for user:', user._id);
console.log('[Auth] Current user fetched:', user._id);
console.log('[Auth] User logged out:', userId);
```

#### **Frontend**

```typescript
// In UserContext.tsx
console.log('[UserContext] Initializing auth...');
console.log('[UserContext] Token found:', !!storedToken);
console.log('[UserContext] User loaded:', userData);
console.log('[UserContext] Login successful:', user);
console.log('[UserContext] Logout complete');
```

---

### Testing Tools

#### **Postman/Insomnia**

Test backend endpoints directly:

**1. Get login URL:**
```
GET http://127.0.0.1:5001/api/v1/auth/login
Follow redirect to Spotify
```

**2. Test callback (hard to test manually - requires Spotify redirect):**
```
GET http://127.0.0.1:5001/api/v1/auth/callback?code=SPOTIFY_CODE
```

**3. Get current user:**
```
GET http://127.0.0.1:5001/api/v1/auth/me
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**4. Logout:**
```
POST http://127.0.0.1:5001/api/v1/auth/logout
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

#### **Browser DevTools**

**Check localStorage:**
```javascript
// In browser console
localStorage.getItem('groupify_token')
```

**Decode JWT:**
```javascript
// In browser console
const token = localStorage.getItem('groupify_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// Output: { userId: "xxx", iat: 1730692800, exp: 1731297600 }
```

**Network tab:**
- Check requests to `/api/v1/auth/*`
- Verify `Authorization` header is present
- Check response status codes

---

## Summary

### Key Takeaways

1. **OAuth 2.0 + JWT Hybrid**
   - Spotify OAuth for initial authentication
   - JWT for ongoing session management

2. **Token Separation**
   - Spotify tokens: Backend only (MongoDB)
   - JWT: Frontend only (localStorage)

3. **Security**
   - Sensitive tokens never exposed to frontend
   - JWT is minimal (only `userId`)
   - Automatic token refresh for Spotify API

4. **User Experience**
   - One-click login with Spotify
   - Persistent sessions (7 days)
   - Seamless token refresh (user never knows)

5. **Architecture**
   - Backend: Controllers → Services → Models
   - Frontend: Context API for global state
   - API client for centralized requests

---

### Next Steps

1. **Implement token blacklisting** (logout invalidates JWT server-side)
2. **Add refresh token endpoint** (refresh JWT without re-login)
3. **Implement role-based access control** (admin vs user)
4. **Add OAuth state parameter** (CSRF protection for OAuth flow)
5. **Set up HTTPS** for production
6. **Add rate limiting** (prevent abuse)
7. **Implement password reset** (if adding email/password auth later)

---

### Resources

- [Spotify OAuth Guide](https://developer.spotify.com/documentation/general/guides/authorization/code-flow/)
- [JWT Introduction](https://jwt.io/introduction)
- [OAuth 2.0 Simplified](https://www.oauth.com/)
- [React Context API](https://react.dev/reference/react/useContext)

---

**Last Updated:** November 4, 2025  
**Version:** 1.0  
**Author:** Groupify Team

