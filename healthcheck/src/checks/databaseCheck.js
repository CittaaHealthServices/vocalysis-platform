const mongoose = require('mongoose');
const logger = require('../logger');

module.exports = async function databaseCheck() {
  try {
    const startTime = Date.now();

    // Perform a ping on the database
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection is not ready');
    }

    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - startTime;

    const result = {
      service: 'database',
      status: 'healthy',
      responseTimeMs: responseTime,
      timestamp: new Date(),
      uptime: true,
      details: {
        readyState: mongoose.connection.readyState,
        dbName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown'
      }
    };

    logger.debug('Database check completed: %j', result);
    return result;
  } catch (error) {
    logger.warn('Database check failed: %s', error.message);

    return {
      service: 'database',
      status: 'down',
      responseTimeMs: 3000,
      error: error.message,
      timestamp: new Date(),
      uptime: false,
      details: {
        readyState: mongoose.connection.readyState
      }
    };
  }
};
