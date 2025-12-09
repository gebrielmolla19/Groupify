const server = require('./app');
const config = require('./config/env');
const mongoose = require('mongoose');

const PORT = config.port;

server.listen(PORT, () => {
    console.log(`[Server] Groupify API server running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`[Server] ${signal} signal received: closing HTTP server`);
    server.close(() => {
        console.log('[Server] HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('[MongoDB] Connection closed');
            process.exit(0);
        });
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
