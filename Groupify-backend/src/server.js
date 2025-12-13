const server = require('./app');
const config = require('./config/env');
const mongoose = require('mongoose');

const PORT = config.port;

server.listen(PORT, () => {
    // Server started
});

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
