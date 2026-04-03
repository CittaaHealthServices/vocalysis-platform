const crypto = require('crypto');
const axios = require('axios');
const logger = require('../logger');

module.exports = async function webhookDeliveryProcessor(job) {
  const { tenantId, event, payload, webhookUrl, webhookSecret, attempt = 1 } = job.data;
  const maxAttempts = 5;
  const backoffSchedule = [
    60 * 1000,           // 1 minute
    5 * 60 * 1000,       // 5 minutes
    30 * 60 * 1000,      // 30 minutes
    2 * 60 * 60 * 1000,  // 2 hours
    6 * 60 * 60 * 1000   // 6 hours
  ];

  try {
    logger.info('Delivering webhook (tenantId: %s, event: %s, attempt: %d/%d)', tenantId, event, attempt, maxAttempts);
    job.progress(20);

    const WebhookDeliveryLog = require('../models/WebhookDeliveryLog');

    // Step 1: Build HMAC-SHA256 signature
    logger.info('Step 1: Building webhook signature');
    job.progress(30);

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    logger.debug('Webhook signature generated for event: %s', event);

    // Step 2: POST to webhook URL with timeout and signature
    logger.info('Step 2: Posting to webhook URL');
    job.progress(50);

    const timestamp = new Date().toISOString();
    const headers = {
      'Content-Type': 'application/json',
      'X-Vocalysis-Signature': signature,
      'X-Vocalysis-Timestamp': timestamp,
      'X-Vocalysis-Event': event,
      'User-Agent': 'Vocalysis-Webhook-Delivery/2.0'
    };

    let responseTime = 0;
    let statusCode = null;
    let responseBody = null;

    try {
      const startTime = Date.now();
      const response = await axios.post(webhookUrl, payload, {
        headers: headers,
        timeout: 10000
      });
      responseTime = Date.now() - startTime;
      statusCode = response.status;
      responseBody = response.data;

      logger.info('Webhook delivered successfully (event: %s, status: %d, responseTime: %dms)', event, statusCode, responseTime);
    } catch (error) {
      statusCode = error.response ? error.response.status : null;
      responseTime = Date.now() - (job.data.startTime || Date.now());
      responseBody = error.response ? error.response.data : { error: error.message };

      logger.warn(
        'Webhook delivery failed (event: %s, attempt: %d, status: %s, error: %s)',
        event,
        attempt,
        statusCode || 'timeout',
        error.message
      );

      throw error;
    }

    job.progress(75);

    // Step 3: Log successful delivery
    logger.info('Step 3: Logging webhook delivery');
    job.progress(80);

    await WebhookDeliveryLog.create({
      tenantId,
      event,
      webhookUrl,
      attempt,
      status: 'success',
      statusCode,
      responseTime,
      signature: signature.substring(0, 16) + '...',
      timestamp: new Date(),
      finalStatus: 'success'
    });

    logger.info('Webhook delivery logged successfully');

    job.progress(100);

    return {
      tenantId,
      event,
      attempt,
      status: 'success',
      statusCode,
      responseTime,
      timestamp: new Date()
    };
  } catch (error) {
    logger.warn('Webhook delivery attempt %d failed: %s', attempt, error.message);
    job.progress(20);

    const WebhookDeliveryLog = require('../models/WebhookDeliveryLog');

    // Log the failed attempt
    await WebhookDeliveryLog.create({
      tenantId,
      event,
      webhookUrl,
      attempt,
      status: 'failed',
      error: error.message,
      timestamp: new Date(),
      finalStatus: attempt >= maxAttempts ? 'failed_permanent' : 'pending_retry'
    });

    // Check if we should retry
    if (attempt < maxAttempts) {
      const nextAttempt = attempt + 1;
      const delayMs = backoffSchedule[attempt - 1] || backoffSchedule[backoffSchedule.length - 1];

      logger.info('Scheduling webhook retry for attempt %d in %dms', nextAttempt, delayMs);

      // Re-queue the job with exponential backoff
      const { queues } = require('../worker');
      await queues.webhookDelivery.add(
        {
          tenantId,
          event,
          payload,
          webhookUrl,
          webhookSecret,
          attempt: nextAttempt
        },
        {
          delay: delayMs,
          jobId: `webhook-${tenantId}-${event}-${Date.now()}-retry${nextAttempt}`
        }
      );

      return {
        tenantId,
        event,
        attempt,
        status: 'retry_scheduled',
        nextAttempt,
        delayMs,
        timestamp: new Date()
      };
    } else {
      // Permanent failure
      logger.error('Webhook delivery permanent failure after %d attempts (tenantId: %s, event: %s)', maxAttempts, tenantId, event);

      throw new Error(`Webhook delivery failed after ${maxAttempts} attempts: ${error.message}`);
    }
  }
};
