require('dotenv').config();
const config = require('./config/env');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');
const logger = require('./utils/logger');
const requestLoggerMiddleware = require('./middleware/requestLoggerMiddleware');
const User = require('./models/User');
const Group = require('./models/Group');
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
const notificationRoutes = require('./routes/notificationRoutes');

// Configure web-push VAPID details
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:groupify@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const app = express();
const server = http.createServer(app);

// Trust proxy (required for correct client IP behind Render, Heroku, etc.)
app.set('trust proxy', 1);

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

// HTTP request/response logging (mount early, before routes)
app.use(requestLoggerMiddleware);

// Security middleware
app.use(helmet());

// Compression middleware (gzip responses)
app.use(compression());

// CORS must come before rate limiter so that 429 responses still include
// Access-Control-Allow-Origin headers (otherwise browsers report CORS errors
// instead of the actual 429).
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting (skip health check, auth, and frequently-polled endpoints)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 2000 : 5000,
  skip: (req) => {
    if (req.path === '/health') return true;
    if (req.path.startsWith('/api/v1/auth/')) return true; // login, callback, etc.
    if (req.path.startsWith('/api/v1/player/')) return true; // playback polled frequently
    if (req.method === 'OPTIONS') return true; // always allow preflight
    return false;
  },
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection check middleware
app.use((req, res, next) => {
  // Allow health check endpoint without database connection
  if (req.path === '/health') {
    return next();
  }
  
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again.'
    });
  }
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    success: dbState === 1,
    message: 'Groupify API is running',
    database: {
      status: dbStates[dbState] || 'unknown',
      readyState: dbState,
      connected: dbState === 1
    },
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
app.use('/api/v1/notifications', notificationRoutes);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('_id isActive');
    if (!user || !user.isActive) return next(new Error('Invalid token'));
    socket.userId = decoded.userId.toString();
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.debug('[Socket.io] Client connected', { socketId: socket.id });

  // Join personal room for targeted notifications
  socket.join(socket.userId);

  socket.on('joinGroup', async (groupId) => {
    const group = await Group.findOne({ _id: groupId, members: socket.userId, isActive: true });
    if (!group) return;
    logger.debug('[Socket.io] Client joined group room', { socketId: socket.id, groupId });
    socket.join(groupId);
  });

  socket.on('leaveGroup', (groupId) => {
    logger.debug('[Socket.io] Client left group room', { socketId: socket.id, groupId });
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
  socket.on('disconnect', (reason) => {
    logger.debug('[Socket.io] Client disconnected', { socketId: socket.id, reason });
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('[Socket.io] Socket error', { socketId: socket.id, error: error.message });
  });
});

// MongoDB connection function
const connectDB = async () => {
  try {
    const isAtlas = config.mongo.uri.includes('mongodb+srv://');
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    };

    logger.info(`[MongoDB] Connecting to ${isAtlas ? 'MongoDB Atlas' : 'MongoDB'}...`);
    
    await mongoose.connect(config.mongo.uri, options);
    
    logger.info('[MongoDB] Connected successfully', { database: mongoose.connection.name });
    
    return mongoose.connection;
  } catch (error) {
    const context = { error: error.message };

    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      context.hint = 'SSL/TLS Error - Check connection string and network settings';
    } else if (error.message.includes('authentication')) {
      context.hint = 'Authentication Error - Check username and password';
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      context.hint = 'Network Error - Check internet connection and hostname';
    }

    logger.error('[MongoDB] Connection error', context);
    throw error;
  }
};

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  logger.warn('[MongoDB] Disconnected from database');
});

mongoose.connection.on('error', (error) => {
  logger.error('[MongoDB] Database error', { error: error.message, stack: error.stack });
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

// Export both server and connectDB function
module.exports = server;
module.exports.connectDB = connectDB;

