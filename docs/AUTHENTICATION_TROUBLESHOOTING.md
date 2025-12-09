# Authentication Troubleshooting Guide

## Common Authentication Errors

### 403 Forbidden Error

A 403 error when logging in with Spotify typically indicates one of the following issues:

#### 1. Redirect URI Mismatch (Most Common)

**Problem:** The redirect URI in your environment variables doesn't exactly match what's registered in your Spotify Developer Dashboard.

**Solution:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Check the "Redirect URIs" section
5. Ensure your `SPOTIFY_REDIRECT_URI` environment variable matches **exactly** (including protocol, domain, port, and path)

**Example:**
- ✅ Correct: `http://localhost:3000/auth/callback`
- ❌ Wrong: `http://localhost:3000/auth/callback/` (trailing slash)
- ❌ Wrong: `https://localhost:3000/auth/callback` (wrong protocol)

**Check your `.env` file:**
```env
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback
```

#### 2. Invalid Client Credentials

**Problem:** Your Spotify Client ID or Client Secret is incorrect or not set.

**Solution:**
1. Verify your `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in your `.env` file
2. Get them from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
3. Ensure there are no extra spaces or quotes in the values

**Check your `.env` file:**
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

#### 3. Insufficient Scopes

**Problem:** The token doesn't have the required scopes to access user profile.

**Solution:**
The following scopes are required and should be automatically requested:
- `user-read-email`
- `user-read-private`
- `user-read-recently-played`
- `user-read-playback-state`
- `user-read-currently-playing`
- `user-modify-playback-state`
- `streaming`

If you're still getting 403 errors, ensure the user grants all permissions during the OAuth flow.

#### 4. Token Exchange Failure

**Problem:** The authorization code exchange is failing silently.

**Solution:**
With the improved error handling, you should now see detailed error messages. Check the server logs for:
- Token exchange errors
- Invalid code errors
- Redirect URI mismatch errors

## Debugging Steps

### Step 1: Check Environment Variables

Verify all required environment variables are set:

```bash
# In your backend directory
cat .env | grep SPOTIFY
```

Required variables:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `FRONTEND_URL` (optional, defaults to localhost:3000)

### Step 2: Verify Spotify App Settings

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Verify:
   - **Redirect URIs** matches your `SPOTIFY_REDIRECT_URI` exactly
   - **App is active** (not in development mode restrictions if applicable)

### Step 3: Check Server Logs

With the improved error handling, you should see detailed logs:

```bash
# Look for these log entries:
[Auth] Token exchange failed: { ... }
[Auth] Failed to fetch user profile: { ... }
```

The logs will include:
- Error messages
- Spotify error details
- Status codes
- Token information (length, presence)

### Step 4: Test the OAuth Flow

1. Clear your browser cookies and cache
2. Try logging in again
3. Check the browser console for any errors
4. Check the server logs for detailed error information

### Step 5: Verify Token Exchange

The improved error handling will now show:
- Whether the token exchange succeeded
- Whether the token is valid
- The exact Spotify error message (if available)

## Error Response Format

With the improved error handling, you'll receive more detailed error responses:

```json
{
  "success": false,
  "message": "Spotify API access denied: [Spotify's error message]",
  "spotifyError": "Detailed error from Spotify API",
  "details": {
    "status": 403,
    "spotifyError": { ... },
    "requiredScopes": ["user-read-email", "user-read-private"]
  },
  "stack": "[Stack trace in development mode]"
}
```

## Common Solutions

### Solution 1: Fix Redirect URI

1. Check your `.env` file for `SPOTIFY_REDIRECT_URI`
2. Go to Spotify Developer Dashboard
3. Add the exact URI to "Redirect URIs"
4. Save changes
5. Restart your backend server
6. Try logging in again

### Solution 2: Regenerate Client Secret

If your client secret might be compromised:

1. Go to Spotify Developer Dashboard
2. Select your app
3. Click "Edit Settings"
4. Click "Reset Client Secret"
5. Update your `.env` file with the new secret
6. Restart your backend server

### Solution 3: Clear Browser Data

Sometimes cached tokens or cookies can cause issues:

1. Clear browser cookies for your app
2. Clear browser cache
3. Try logging in again in an incognito/private window

### Solution 4: Check Network/Firewall

Ensure your backend can reach:
- `https://accounts.spotify.com/api/token`
- `https://api.spotify.com/v1`

## Testing the Fix

After applying fixes:

1. **Restart your backend server:**
   ```bash
   cd Groupify-backend
   npm start
   ```

2. **Clear browser data** (cookies, cache)

3. **Try logging in again**

4. **Check the error response** - it should now provide more details about what went wrong

5. **Check server logs** - look for detailed error information

## Still Having Issues?

If you're still experiencing 403 errors after trying the above:

1. **Check the detailed error response** - The improved error handling will show Spotify's exact error message
2. **Review server logs** - Look for `[Auth]` prefixed log entries
3. **Verify all environment variables** are set correctly
4. **Test with a different Spotify account** to rule out account-specific issues
5. **Check Spotify API status** at [Spotify Status Page](https://status.spotify.com/)

## Prevention

To prevent this issue in the future:

1. **Always match redirect URIs exactly** - No trailing slashes, correct protocol
2. **Keep environment variables secure** - Never commit `.env` files
3. **Document your redirect URIs** - Keep a list of all URIs you use
4. **Test with multiple accounts** - Ensure it works for different users
5. **Monitor error logs** - Set up logging to catch issues early

