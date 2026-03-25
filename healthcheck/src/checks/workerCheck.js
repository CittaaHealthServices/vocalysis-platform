const Redis = require('ioredis');
const logger = require('../logger');

module.exports = async function workerCheck() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 3000
  });

  try {
    // Bull stores queue data in Redis with specific key patterns
    const queueNames = [
      'audio-analysis',
      'pdf-generation',
      'email-notifications',
      'webhook-delivery',
      'bulk-employee-import'
    ];

    const stats = {};
    let hasIssue = false;

    for (const queueName of queueNames) {
      try {
        // Get queue stats from Redis (Bull stores them with these keys)
        const waitingKey = `bull:${queueName}:wait`;
        const activeKey = `bull:${queueName}:active`;
        const failedKey = `bull:${queueName}:failed`;

        const waiting = await redis.llen(waitingKey);
        const active = await redis.llen(activeKey);
        const failed = await redis.zcard(failedKey);

        stats[queueName] = {
          waiting: waiting || 0,
          active: active || 0,
          failed: failed || 0
        };

        // Check for alert conditions
        if (failed > 10) {
          logger.warn('Worker queue %s has %d failed jobs', queueName, failed);
          hasIssue = true;
        }

        if (waiting > 100) {
          logger.warn('Worker queue %s has %d waiting jobs (backlog)', queueName, waiting);
          hasIssue = true;
        }
      } catch (error) {
        logger.debug('Failed to get stats for queue %s: %s', queueName, error.message);
        stats[queueName] = {
          waiting: 0,
          active: 0,
          failed: 0,
          error: error.message
        };
      }
    }

    const result = {
      service: 'worker',
      status: hasIssue ? 'degraded' : 'healthy',
      queueStats: stats,
      timestamp: new Date(),
      uptime: !hasIssue,
      totalWaiting: Object.values(stats).reduce((sum, q) => sum + (q.waiting || 0), 0),
      totalActive: Object.values(stats).reduce((sum, q) => sum + (q.active || 0), 0),
      totalFailed: Object.values(stats).reduce((sum, q) => sum + (q.failed || 0), 0)
    };

    logger.debug('Worker check completed: %j', result);
    redis.disconnect();
    return result;
  } catch (error) {
    logger.warn('Worker check failed: %s', error.message);

    redis.disconnect();
    return {
      service: 'worker',
      status: 'down',
      queueStats: {},
      error: error.message,
      timestamp: new Date(),
      uptime: false,
      totalWaiting: 0,
      totalActive: 0,
      totalFailed: 0
    };
  }
};
