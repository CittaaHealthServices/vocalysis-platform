const Redis = require('ioredis');
const logger = require('../logger');

module.exports = async function redisCheck() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 3000
  });

  try {
    const startTime = Date.now();

    // Send PING command
    const pongResponse = await redis.ping();
    const responseTime = Date.now() - startTime;

    // Get memory usage info
    let memoryUsageMb = 0;
    try {
      const info = await redis.info('memory');
      const memoryUsedMatch = info.match(/used_memory:(\d+)/);
      if (memoryUsedMatch) {
        memoryUsageMb = Math.round(parseInt(memoryUsedMatch[1]) / 1024 / 1024);
      }
    } catch (infoError) {
      logger.debug('Failed to get Redis memory info: %s', infoError.message);
    }

    const result = {
      service: 'redis',
      status: pongResponse === 'PONG' ? 'healthy' : 'degraded',
      latencyMs: responseTime,
      memoryUsageMb,
      timestamp: new Date(),
      uptime: pongResponse === 'PONG'
    };

    logger.debug('Redis check completed: %j', result);
    redis.disconnect();
    return result;
  } catch (error) {
    logger.warn('Redis check failed: %s', error.message);

    redis.disconnect();
    return {
      service: 'redis',
      status: 'down',
      latencyMs: 3000,
      memoryUsageMb: 0,
      error: error.message,
      timestamp: new Date(),
      uptime: false
    };
  }
};
