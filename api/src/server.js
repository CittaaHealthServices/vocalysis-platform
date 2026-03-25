require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const mongoose = require('mongoose');
const redis = require('./utils/redis');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;
let isShuttingDown = false;

/**
 * Connect to MongoDB
 */
async function connectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vocalysis', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('Failed to connect to MongoDB', { error: err.message });
    process.exit(1);
  }
}

/**
 * Verify Redis connection
 */
async function verifyRedis() {
  try {
    await redis.ping();
    logger.info('Connected to Redis');
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: err.message });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Set shutdown timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Disconnect MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

    // Close Redis connection
    await redis.quit();
    logger.info('Closed Redis connection');

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Start server
 */
async function startServer() {
  try {
    // Connect to databases
    await connectMongoDB();
    await verifyRedis();

    // Create HTTP server
    server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`Vocalysis Platform API Server listening on port ${PORT}`, {
        environment: NODE_ENV,
        nodeVersion: process.version
      });
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error', { error: err.message });
      }
      process.exit(1);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason: String(reason)
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception', {
        error: err.message,
        stack: err.stack
      });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = server;
