const Redis = require('ioredis');
const logger = require('./logger');

let retryCount = 0;
const MAX_RETRY_DELAY = 30000;

const redis = new Redis({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  lazyConnect: true,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    retryCount = times;
    const delay = Math.min(times * 50, MAX_RETRY_DELAY);
    logger.warn('Redis reconnecting', {
      attempt: times,
      delayMs: delay,
    });
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      logger.warn('Redis READONLY error, reconnecting');
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  retryCount = 0;
  logger.info('Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('Redis ready to accept commands');
});

redis.on('error', (error) => {
  logger.error('Redis error', {
    error: error.message,
    code: error.code,
  });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting', {
    attempt: retryCount,
  });
});

const disconnect = async () => {
  try {
    if (redis.status !== 'end' && redis.status !== 'wait') {
      await redis.quit();
      logger.info('Redis connection closed gracefully');
    }
  } catch (error) {
    logger.error('Error closing Redis connection', {
      error: error.message,
    });
    throw error;
  }
};

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing Redis connection gracefully');
  await disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing Redis connection gracefully');
  await disconnect();
  process.exit(0);
});

const ensureRedisConnection = async () => {
  if (redis.status === 'ready' || redis.status === 'connect') {
    return redis;
  }

  if (redis.status === 'connecting') {
    await new Promise((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
    return redis;
  }

  await redis.connect();
  return redis;
};

redis.ensureConnection = ensureRedisConnection;

module.exports = redis;
