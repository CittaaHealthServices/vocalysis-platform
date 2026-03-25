const mongoose = require('mongoose');
const logger = require('./logger');

let isConnecting = false;
let isConnected = false;

const connectDB = async (retries = 5, delay = 3000) => {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  if (isConnecting) {
    logger.info('Database connection already in progress');
    return;
  }

  isConnecting = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vocalysis';

      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 100,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      isConnected = true;
      isConnecting = false;
      logger.info('MongoDB connected successfully', {
        host: conn.connection.host,
        database: conn.connection.name,
      });

      return conn;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed`, {
        error: error.message,
        attempt,
        retries,
        nextRetryIn: attempt < retries ? delay : 'no retry',
      });

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        isConnecting = false;
        throw new Error(`Failed to connect to MongoDB after ${retries} attempts: ${error.message}`);
      }
    }
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  isConnected = false;
  logger.error('Mongoose connection error', {
    error: error.message,
    code: error.code,
  });
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  isConnecting = false;
  logger.warn('Mongoose disconnected from MongoDB');
});

const disconnectDB = async () => {
  try {
    if (isConnected) {
      await mongoose.disconnect();
      isConnected = false;
      logger.info('MongoDB connection closed');
    }
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', {
      error: error.message,
    });
    throw error;
  }
};

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connection gracefully');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connection gracefully');
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB,
  isConnected: () => isConnected,
};
