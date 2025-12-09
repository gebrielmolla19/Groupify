# Groupify Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Start MongoDB
```bash
# Check if MongoDB is running
mongosh

# If not running, start it
brew services start mongodb-community
# OR
mongod --config /usr/local/etc/mongod.conf
```

### Step 2: Start Backend
```bash
cd ~/Documents/Coding/AI/Learning/Groupify/Groupify-backend
npm run dev
```

✅ Should see: `MongoDB connected successfully` + `Server is running on port 5001`

### Step 3: Start Frontend
```bash
# New terminal window
cd ~/Documents/Coding/AI/Learning/Groupify/Groupify-frontend
npm run dev
```

✅ Should see: `Local: http://localhost:3000/`

### Step 4: Test It!

1. Open http://localhost:3000
2. Click "Login with Spotify"
3. Authorize the app
4. You're in! 🎉

---

## 📚 Understanding the Codebase

### Most Important Files to Start With

**Frontend (React):**
```
src/
├── components/
│   ├── DashboardScreen.tsx      ← Start here! Shows groups
│   ├── GroupFeedScreen.tsx      ← Shows shared tracks
│   └── AnalyticsScreen.tsx      ← Shows stats
├── hooks/
│   ├── useGroups.ts             ← Start here! Manages groups
│   └── useGroupFeed.ts          ← Manages feed
└── lib/
    └── api.ts                   ← All HTTP requests
```

**Backend (Node.js):**
```
src/
├── routes/
│   └── groupRoutes.js           ← URL mappings
├── controllers/
│   └── groupController.js       ← Request handlers
├── services/
│   └── groupService.js          ← Start here! Business logic
└── models/
    └── Group.js                 ← Data structure
```

---

## 🎯 Trace Your First Feature (10 minutes)

### Follow "Display Groups on Dashboard"

**1. Frontend Component** (`DashboardScreen.tsx` line 17)
```typescript
const { groups, isLoading, error } = useGroups();
```
👉 Uses a hook to get groups

**2. Custom Hook** (`useGroups.ts` line 18)
```typescript
const fetchGroups = async () => {
  const fetchedGroups = await apiGetUserGroups();
  setGroups(fetchedGroups);
};
```
👉 Calls API function

**3. API Client** (`api.ts` line 172)
```typescript
export const getUserGroups = async () => {
  const response = await fetchWithAuth('/groups');
  return response.json();
};
```
👉 Makes HTTP GET request to `/api/v1/groups`

**4. Backend Route** (`groupRoutes.js` line 11)
```javascript
router.get('/', authMiddleware, GroupController.getUserGroups);
```
👉 Routes to controller

**5. Controller** (`groupController.js` line 13)
```javascript
const groups = await GroupService.getUserGroups(req.userId);
res.json({ success: true, groups });
```
👉 Delegates to service

**6. Service** (`groupService.js` line 45)
```javascript
const groups = await Group.find({ members: userId })
  .populate('createdBy')
  .populate('members');
return groups;
```
👉 Queries MongoDB

**7. Data flows back up** → Component renders groups!

---

## 🔧 Common Tasks

### Add Console Logs to Debug

**Frontend:**
```typescript
// In useGroups.ts
const fetchGroups = async () => {
  console.log('🔍 Fetching groups...');
  const data = await apiGetUserGroups();
  console.log('✅ Got groups:', data);
  setGroups(data);
};
```

**Backend:**
```javascript
// In groupService.js
static async getUserGroups(userId) {
  console.log('🔍 Getting groups for user:', userId);
  const groups = await Group.find({ members: userId });
  console.log('✅ Found', groups.length, 'groups');
  return groups;
}
```

Then open:
- **Frontend:** Browser DevTools (F12) → Console tab
- **Backend:** Terminal where backend is running

### Check Database

```bash
# Open MongoDB shell
mongosh

# Switch to database
use groupify

# See all groups
db.groups.find().pretty()

# See all users
db.users.find().pretty()

# See all shares
db.shares.find().pretty()
```

### Test API Directly

```bash
# Get your JWT token from browser
# 1. Open http://localhost:3000
# 2. Login
# 3. Open DevTools (F12) → Application → Local Storage
# 4. Copy value of 'groupify_token'

# Test API
curl http://127.0.0.1:5001/api/v1/groups \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎓 Learning Path

### Day 1: Understand Structure
1. Read `HOW_IT_WORKS.md` (comprehensive guide)
2. Trace one feature end-to-end (like above)
3. Add console.logs and watch data flow

### Day 2: Understand State
1. Open `useGroups.ts` - see how state is managed
2. Understand `useState`, `useEffect`, `useCallback`
3. Modify a hook and see what happens

### Day 3: Understand Backend
1. Open `groupService.js` - see business logic
2. Add a `console.log` in a service method
3. Make API call from frontend and watch backend logs

### Day 4: Make Changes
1. Add a new field to Group model
2. Update the UI to show it
3. See it persist in MongoDB

### Day 5: Build Something
1. Pick a feature from TODO list
2. Implement it step by step
3. Test it end-to-end

---

## 💡 Key Concepts

### 1. How Data Flows
```
User clicks button
    ↓
Component calls hook function
    ↓
Hook calls API function
    ↓
API makes HTTP request
    ↓
Backend route receives request
    ↓
Controller delegates to service
    ↓
Service queries database
    ↓
Data flows back up
    ↓
Component re-renders with new data
```

### 2. Three Types of State

```typescript
// 1. Local state (component only)
const [count, setCount] = useState(0);

// 2. Global state (app-wide)
const { user } = useUser();

// 3. Server state (from API)
const { groups } = useGroups();
```

### 3. Backend Layers

```
Route → Controller → Service → Model → MongoDB
  ↓         ↓          ↓         ↓
Define   Handle    Logic    Schema
URL      HTTP      goes     defines
         req/res   here     structure
```

**Rule:** NO business logic in controllers. ALL logic in services.

### 4. Always Handle Errors

```typescript
// Frontend
try {
  await apiCall();
  toast.success('Success!');
} catch (error) {
  toast.error('Failed!');
}

// Backend
try {
  const result = await service.method();
  res.json({ success: true, result });
} catch (error) {
  next(error); // Goes to error middleware
}
```

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
```bash
# Check if backend is running
lsof -i :5001

# If nothing, start it
cd Groupify-backend && npm run dev
```

### "MongoDB connection error"
```bash
# Check if MongoDB is running
pgrep mongo

# If nothing, start it
brew services start mongodb-community
```

### "Login not working"
1. Check backend is running on port 5001
2. Check Spotify credentials in `.env`
3. Check browser console for errors

### "Data not showing"
1. Check browser console (F12)
2. Check Network tab - are requests succeeding?
3. Check backend terminal - any errors?
4. Check MongoDB - is data there?

---

## 📖 File Reference

### When to Edit Which File

**Want to change UI?**
→ `src/components/*.tsx`

**Want to change data fetching?**
→ `src/hooks/*.ts`

**Want to add API endpoint?**
→ Backend: `src/routes/*.js` + `src/controllers/*.js` + `src/services/*.js`

**Want to change data structure?**
→ Backend: `src/models/*.js`
→ Frontend: `src/types/index.ts`

---

## 🎯 Your First Task

Try this simple modification:

1. **Add "Member Count" badge to group cards**

```typescript
// In DashboardScreen.tsx, find the GroupCard
<Card>
  {/* ... existing code ... */}
  
  {/* Add this: */}
  <Badge>
    {group.members.length} members
  </Badge>
</Card>
```

2. **Refresh browser** → See the badge! ✅

That's your first modification! Now try:
- Changing the color
- Adding an icon
- Showing it on hover only

---

## 🚀 Next Steps

1. ✅ Get both servers running
2. ✅ Login successfully
3. ✅ Trace one feature (follow guide above)
4. ✅ Add console.logs and watch flow
5. ✅ Make one small UI change
6. 📖 Read full `HOW_IT_WORKS.md`
7. 🔨 Build your first feature!

**You got this!** 💪

---

## 📚 More Resources

- **Full Architecture Guide:** `HOW_IT_WORKS.md`
- **Backend Details:** `Groupify-backend/BACKEND_IMPLEMENTATION_SUMMARY.md`
- **Frontend Progress:** `FRONTEND_INTEGRATION_COMPLETE.md`
- **Start Servers:** `START_SERVERS.md`

**Questions?** Add console.logs everywhere and watch the magic happen! 🎩✨


