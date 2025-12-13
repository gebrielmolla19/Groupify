require('dotenv').config();
const config = require('./config/env');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
// const { startScheduler } = require('./utils/scheduler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const groupSettingsRoutes = require('./routes/groupSettingsRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const shareRoutes = require('./routes/shareRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require('./routes/userRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const playerRoutes = require('./routes/playerRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store io instance in app for use in controllers
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Groupify API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/groups', groupSettingsRoutes);
app.use('/api/v1/groups', inviteRoutes);
app.use('/api/v1/shares', shareRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/spotify', spotifyRoutes);
app.use('/api/v1/player', playerRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  // Join group room when user connects to a group
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
  });

  // Leave group room
  socket.on('leaveGroup', (groupId) => {
    socket.leave(groupId);
  });

  // Handle songShared event (already handled in controller, but can add more logic here)
  socket.on('songShared', (data) => {
    // This can be used for additional real-time features
  });

  // Handle songListened event
  socket.on('songListened', (data) => {
    // Emit to all users in the group that a song was listened to
    if (data.groupId) {
      io.to(data.groupId.toString()).emit('songListened', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // User disconnected
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`[Socket.io] Error for socket ${socket.id}:`, error);
  });
});

// MongoDB connection
mongoose.connect(config.mongo.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    // Connected to database successfully
  })
  .catch((error) => {
    console.error('[MongoDB] Connection error:', error.message);
    process.exit(1);
  });

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  // Disconnected from database
});

mongoose.connection.on('error', (error) => {
  console.error('[MongoDB] Database error:', error);
});

// Start scheduled tasks (cron jobs)
// TODO: Enable scheduler when ready
// startScheduler(io);

// Import error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Centralized error handling middleware (must be last)
app.use(errorHandler);

module.exports = server;

