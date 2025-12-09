# How to Start Groupify Application

## Prerequisites
- MongoDB running (check with `mongosh` or MongoDB Compass)
- Node.js installed
- Environment files configured

## Starting the Servers

### Terminal 1: Backend Server
```bash
cd /Users/gebrielbelaineh/Documents/Coding/AI/Learning/Groupify/Groupify-backend
npm run dev
```

**Expected Output:**
```
MongoDB connected successfully
Server is running on port 5001
Socket.io initialized
```

### Terminal 2: Frontend Server
```bash
cd /Users/gebrielbelaineh/Documents/Coding/AI/Learning/Groupify/Groupify-frontend
npm run dev
```

**Expected Output:**
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

## Verification

1. **Backend Health Check:**
   ```bash
   curl http://127.0.0.1:5001/api/v1/auth/login
   ```
   Should redirect or return a response (not connection refused)

2. **Frontend Access:**
   Open http://localhost:3000 in your browser

3. **Login Test:**
   - Click "Login with Spotify"
   - Should redirect to Spotify OAuth
   - After authorization, should redirect back and login

## Troubleshooting

### Backend won't start
**Error: "Address already in use"**
```bash
# Find what's using port 5001
lsof -i :5001

# Kill the process
kill -9 <PID>
```

**Error: "Cannot connect to MongoDB"**
```bash
# Start MongoDB
brew services start mongodb-community
# OR
mongod --config /usr/local/etc/mongod.conf
```

**Error: "Missing environment variables"**
- Check `/Users/gebrielbelaineh/Documents/Coding/AI/Learning/Groupify/Groupify-backend/.env` exists
- Verify required variables: PORT, MONGODB_URI, JWT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

### Frontend won't start
**Error: "Port 3000 already in use"**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Login fails
**Check Backend is Running:**
```bash
curl http://127.0.0.1:5001/api/v1/auth/login
```
If this fails with "Connection refused", backend is not running.

**Check Spotify Credentials:**
- Verify SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend .env
- Verify redirect URI matches Spotify app settings

**Check Browser Console:**
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

## Quick Start (Both Servers)

```bash
# Open two terminal windows

# Terminal 1 (Backend)
cd ~/Documents/Coding/AI/Learning/Groupify/Groupify-backend && npm run dev

# Terminal 2 (Frontend)  
cd ~/Documents/Coding/AI/Learning/Groupify/Groupify-frontend && npm run dev
```

## Common Issues

### "Cannot GET /api/v1/auth/login"
- Backend is running but route is wrong
- Check routes in `Groupify-backend/src/routes/authRoutes.js`

### "CORS Error"
- Backend CORS not configured for frontend URL
- Check `FRONTEND_URL` in backend .env matches frontend URL

### "Unauthorized" / "401"
- Token expired or invalid
- Clear browser localStorage and re-login

### Spotify redirect fails
- Check `SPOTIFY_REDIRECT_URI` in backend .env
- Must match exactly in Spotify Developer Dashboard
- Should be: `http://127.0.0.1:5001/api/v1/auth/callback`

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/groupify
JWT_SECRET=your-secret-key-here
SPOTIFY_CLIENT_ID=eae8ae73974447b281d70dbed62ce842
SPOTIFY_CLIENT_SECRET=10604b5912b046aeb7721131c4ab7aa4
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5001/api/v1/auth/callback
FRONTEND_URL=http://127.0.0.1:3000
```

### Frontend (.env) - OPTIONAL
```env
VITE_API_BASE_URL=http://127.0.0.1:5001/api/v1
```
(If not set, defaults to http://127.0.0.1:5001/api/v1)

## Success Checklist
- [ ] Backend server running on port 5001
- [ ] Frontend server running on port 3000
- [ ] MongoDB connected
- [ ] Can access http://localhost:3000
- [ ] "Login with Spotify" button works
- [ ] After Spotify auth, redirects back successfully
- [ ] Dashboard loads with user data

