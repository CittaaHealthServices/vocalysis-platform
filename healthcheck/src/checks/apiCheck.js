const axios = require('axios');
const logger = require('../logger');

module.exports = async function apiCheck() {
  const apiUrl = process.env.API_URL || 'https://api.vocalysis.cittaa.in/health';
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
