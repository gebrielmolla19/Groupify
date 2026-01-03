const server = require('./app');
const config = require('./config/env');
const { connectDB } = require('./app');
const mongoose = require('mongoose');

const PORT = config.port;

// Connect to MongoDB before starting server
const startServer = async () => {
  try {
    console.log('[Server] Starting server initialization...');
    console.log(`[Server] Port: ${PORT}`);
    console.log(`[Server] Environment: ${config.env}`);
    
    // Wait for MongoDB connection
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();
    
    // Start server only after database is connected
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] ✅ Server is running!`);
      console.log(`[Server] Listening on port ${PORT}`);
      console.log(`[Server] Environment: ${config.env}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] API base: http://127.0.0.1:${PORT}/api/v1`);
      console.log(`[Server] Frontend expects: http://127.0.0.1:5001/api/v1`);
      if (PORT !== 5001) {
        console.warn(`[Server] ⚠️  Port mismatch! Frontend expects port 5001, but server is on port ${PORT}`);
        console.warn(`[Server] Set PORT=5001 in .env or update frontend config to use port ${PORT}`);
      }
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[Server] ❌ Port ${PORT} is already in use!`);
        console.error(`[Server] Try: lsof -ti:${PORT} | xargs kill -9`);
        console.error(`[Server] Or change PORT in .env file`);
      } else {
        console.error('[Server] Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('[Server] ❌ Failed to start server');
    console.error('[Server] Error:', error.message);
    console.error('[Server] Stack:', error.stack);
    
    if (error.message.includes('MongoDB') || error.message.includes('connection')) {
      console.error('\n[Server] MongoDB connection failed. Server cannot start without database.');
      console.error('[Server] Please check:');
      console.error('  1. MongoDB connection string in .env (MONGO_URI)');
      console.error('  2. MongoDB service is running (if local)');
      console.error('  3. Network connectivity (if Atlas)');
      console.error('  4. IP whitelist in Atlas (if using Atlas)');
    }
    
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
    server.close(() => {
        mongoose.connection.close(false, () => {
            process.exit(0);
        });
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
