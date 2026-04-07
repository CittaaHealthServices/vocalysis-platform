const axios = require('axios');
const logger = require('../logger');

module.exports = async function apiCheck() {
  // API_URL may be set to either a base URL (https://api.mindbridge.cittaa.in)
  // or a full health endpoint. Normalise: strip trailing slash, then append
  // /health only when the path doesn't already end with /health.
  const rawUrl = (process.env.API_URL || 'https://api.mindbridge.cittaa.in').replace(/\/$/, '');
  const apiUrl = /\/health$/.test(rawUrl) ? rawUrl : `${rawUrl}/health`;
  const timeout = 5000;

  try {
    const startTime = Date.now();

    const response = await axios.get(apiUrl, {
      timeout: timeout,
      validateStatus: () => true // Accept any status code
    });

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    // Determine health status based on response time and status code
    let status = 'healthy';
    if (statusCode !== 200) {
      status = 'down';
    } else if (responseTime > 2000) {
      status = 'degraded';
    } else if (responseTime > 500) {
      status = 'degraded';
    }

    const result = {
      service: 'api',
      status,
      responseTimeMs: responseTime,
      statusCode,
      url: apiUrl,
      timestamp: new Date(),
      uptime: status === 'healthy'
    };

    logger.debug('API check completed: %j', result);
    return result;
  } catch (error) {
    const responseTime = error.response ? (Date.now() - error.response.config.startTime) : timeout;

    logger.warn('API check failed: %s', error.message);

    return {
      service: 'api',
      status: 'down',
      responseTimeMs: responseTime,
      statusCode: error.response ? error.response.status : null,
      error: error.message,
      url: apiUrl,
      timestamp: new Date(),
      uptime: false
    };
  }
};
