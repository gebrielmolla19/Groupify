const server = require('./app');
const config = require('./config/env');
const { connectDB } = require('./app');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

const PORT = config.port;

// Connect to MongoDB before starting server
const startServer = async () => {
  try {
    logger.info('[Server] Starting server initialization...', {
      port: PORT,
      environment: config.env
    });

    logger.info('[Server] Connecting to MongoDB...');
    await connectDB();

    // Start server only after database is connected
    server.listen(PORT, '0.0.0.0', () => {
      logger.info('[Server] Server is running!', {
        port: PORT,
        environment: config.env,
        healthCheck: `http://localhost:${PORT}/health`,
        apiBase: `http://127.0.0.1:${PORT}/api/v1`
      });

      if (PORT !== 5001) {
        logger.warn('[Server] Port mismatch! Frontend expects port 5001', {
          actualPort: PORT,
          expectedPort: 5001,
          fix: 'Set PORT=5001 in .env or update frontend config'
        });
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`[Server] Port ${PORT} is already in use!`, {
          port: PORT,
          fix: `lsof -ti:${PORT} | xargs kill -9`
        });
      } else {
        logger.error('[Server] Server error', { error: error.message, stack: error.stack });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('[Server] Failed to start server', {
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('MongoDB') || error.message.includes('connection')) {
      logger.error('[Server] MongoDB connection failed. Server cannot start without database.', {
        checks: [
          'MongoDB connection string in .env (MONGO_URI)',
          'MongoDB service is running (if local)',
          'Network connectivity (if Atlas)',
          'IP whitelist in Atlas (if using Atlas)'
        ]
      });
    }

    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`[Server] ${signal} received — shutting down gracefully...`);
  server.close(() => {
    logger.info('[Server] HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('[Server] MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
