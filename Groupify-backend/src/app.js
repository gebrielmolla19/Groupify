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

// Security middleware
app.use(helmet());

// Compression middleware (gzip responses)
app.use(compression());

// Rate limiting (skip health check for load balancers)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  skip: (req) => req.path === '/health',
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// CORS and body parsing
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
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
      message: 'Database connection not ready. Please try again in a moment.',
      readyState: mongoose.connection.readyState,
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      states: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      }
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

// MongoDB connection function
const connectDB = async () => {
  try {
    const isAtlas = config.mongo.uri.includes('mongodb+srv://');
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    };

    console.log(`[MongoDB] Connecting to ${isAtlas ? 'MongoDB Atlas' : 'MongoDB'}...`);
    
    await mongoose.connect(config.mongo.uri, options);
    
    console.log('[MongoDB] Connected successfully');
    console.log(`[MongoDB] Database: ${mongoose.connection.name}`);
    
    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.error('[MongoDB] SSL/TLS Error - Check connection string and network settings');
    } else if (error.message.includes('authentication')) {
      console.error('[MongoDB] Authentication Error - Check username and password');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.error('[MongoDB] Network Error - Check internet connection and hostname');
    }
    
    throw error;
  }
};

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database');
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

// Export both server and connectDB function
module.exports = server;
module.exports.connectDB = connectDB;

