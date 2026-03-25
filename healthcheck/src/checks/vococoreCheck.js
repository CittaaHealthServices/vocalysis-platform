const axios = require('axios');
const logger = require('../logger');

module.exports = async function vococoreCheck() {
  // Try internal Railway URL first, then fallback to env var
  const urls = [
    'http://vocalysis-vococore.railway.internal/health',
    process.env.VOCOCORE_SERVICE_URL ? `${process.env.VOCOCORE_SERVICE_URL}/health` : null
  ].filter(Boolean);

  const timeout = 3000;
  let lastError = null;

  for (const vococoreUrl of urls) {
    try {
      const startTime = Date.now();

      const response = await axios.get(vococoreUrl, {
        timeout: timeout,
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;
      const statusCode = response.status;

      // Determine health status
      let status = 'healthy';
      if (statusCode !== 200) {
        status = 'down';
      } else if (responseTime > 2000) {
        status = 'degraded';
      }

      const result = {
        service: 'vococore',
        status,
        responseTimeMs: responseTime,
        statusCode,
        url: vococoreUrl,
        timestamp: new Date(),
        uptime: status === 'healthy'
      };

      logger.debug('VocaCore check completed: %j', result);
      return result;
    } catch (error) {
      lastError = error;
      logger.debug('VocaCore check failed on URL %s: %s', vococoreUrl, error.message);
      continue;
    }
  }

  // All URLs failed
  logger.warn('VocaCore check failed on all URLs: %s', lastError ? lastError.message : 'No URLs available');

  return {
    service: 'vococore',
    status: 'down',
    responseTimeMs: timeout,
    statusCode: null,
    error: lastError ? lastError.message : 'No VocaCore URLs configured',
    timestamp: new Date(),
    uptime: false
  };
};
