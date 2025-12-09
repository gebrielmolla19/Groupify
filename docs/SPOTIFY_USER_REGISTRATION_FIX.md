# Fix: User Not Registered Error (403)

## Problem

You're getting this error when trying to log in with a different Spotify account:

```
"Check settings on developer.spotify.com/dashboard, the user may not be registered."
```

## Root Cause

Your Spotify app is in **Development Mode**, which means only users who are explicitly added as test users can use the app. When you try to log in with a Spotify account that isn't in your test user list, Spotify returns a 403 error.

## Solution

You have two options to fix this:

### Option 1: Add User as Test User (Recommended for Development)

This is the quickest solution for testing with specific users.

1. **Go to Spotify Developer Dashboard**
   - Visit: https://developer.spotify.com/dashboard
   - Log in with your Spotify account

2. **Select Your App**
   - Click on your app (the one matching your `SPOTIFY_CLIENT_ID`)

3. **Add Test Users**
   - Click on **"Edit Settings"** or **"Settings"**
   - Scroll down to the **"User Management"** section
   - Under **"Users"**, click **"Add User"**
   - Enter the **Spotify email address** of the user you want to add
   - Click **"Add"**

4. **Save Changes**
   - Click **"Add"** or **"Save"** at the bottom of the settings page

5. **Try Logging In Again**
   - The user should now be able to log in successfully

**Note:** You can add up to 25 test users in Development Mode.

### Option 2: Switch to Extended Quota Mode (For Production)

If you need to allow more users or want to make your app publicly available:

1. **Go to Spotify Developer Dashboard**
   - Visit: https://developer.spotify.com/dashboard
   - Log in with your Spotify account

2. **Select Your App**
   - Click on your app

3. **Request Extended Quota**
   - Click on **"Edit Settings"** or **"Settings"**
   - Look for **"Extended Quota Mode"** or **"Quota Extension"** section
   - Click **"Request Extended Quota"** or **"Apply for Extended Quota"**
   - Fill out the form with:
     - Your app's use case
     - Expected number of users
     - How you'll use the Spotify API
   - Submit the request

4. **Wait for Approval**
   - Spotify will review your request (usually takes a few days)
   - Once approved, your app can be used by any Spotify user (up to your quota limit)

**Note:** Extended Quota Mode allows up to 200,000 monthly active users. For more users, you'll need to submit a quota extension request.

## Verification Steps

After adding a test user:

1. **Verify the User is Added**
   - Go back to your app settings
   - Check the "Users" list - the email should be there

2. **Clear Browser Data** (Important!)
   - Clear cookies and cache for your app
   - Or use an incognito/private window

3. **Try Logging In Again**
   - Use the Spotify account that matches the email you added
   - The login should now work

## Common Issues

### Issue: "User still can't log in after adding them"

**Solutions:**
- Make sure you're using the **exact email address** associated with the Spotify account
- Clear browser cookies and cache
- Wait a few minutes for changes to propagate
- Verify the user is actually in the test user list in the dashboard

### Issue: "I don't see the 'Add User' option"

**Solutions:**
- Make sure you're logged into the correct Spotify Developer account
- Verify you're viewing the correct app (check the Client ID matches)
- Some apps may have different UI - look for "User Management" or "Test Users" section

### Issue: "I need to add more than 25 users"

**Solutions:**
- You'll need to request Extended Quota Mode (Option 2 above)
- Or create multiple Spotify apps for different user groups

## Development vs Production

### Development Mode (Current)
- ✅ Quick setup
- ✅ No approval needed
- ❌ Limited to 25 test users
- ❌ Users must be manually added

### Extended Quota Mode
- ✅ Up to 200,000 monthly active users
- ✅ No need to manually add users
- ❌ Requires approval from Spotify
- ❌ May take a few days to get approved

## Best Practices

1. **For Development:**
   - Add your main test accounts as test users
   - Keep a list of test user emails for easy reference
   - Document which accounts are test users

2. **For Production:**
   - Request Extended Quota Mode well before launch
   - Monitor your quota usage
   - Have a plan for requesting additional quota if needed

3. **Testing:**
   - Always test with multiple accounts
   - Test with accounts that are and aren't test users
   - Verify error messages are user-friendly

## Error Message After Fix

After implementing the fix, the error message will now be more helpful:

```json
{
  "success": false,
  "message": "User not registered as a test user. Your Spotify app is in Development Mode. Please add this user as a test user in your Spotify Developer Dashboard, or switch to Extended Quota Mode.",
  "spotifyError": "Check settings on developer.spotify.com/dashboard, the user may not be registered.",
  "isUserNotRegistered": true
}
```

## Quick Reference

**Spotify Developer Dashboard:** https://developer.spotify.com/dashboard

**Steps to Add Test User:**
1. Dashboard → Your App → Edit Settings
2. Scroll to "User Management" → "Users"
3. Click "Add User"
4. Enter Spotify email address
5. Save

**Test User Limit:** 25 users in Development Mode

**Extended Quota Limit:** Up to 200,000 monthly active users (requires approval)

