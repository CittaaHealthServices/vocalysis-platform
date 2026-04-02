require('dotenv').config();
const Bull = require('bull');
const cron = require('node-cron');
const logger = require('./logger');
const { connectDB, disconnectDB } = require('./db');

// Global queues object
const queues = {
  audioAnalysis:    null,
  pdfGeneration:    null,
  emailNotifications: null,
  webhookDelivery:  null,
  bulkImport:       null,
  followUpReminders: null,  // 3-day outcome follow-up pings
};

async function initializeWorker() {
  try {
    logger.info('Initializing Vocalysis Worker Service v2.0');

    // Connect to MongoDB
    await connectDB();

    // Create Bull queues
    logger.info('Creating Bull queues');

    queues.audioAnalysis = new Bull('audio-analysis', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        timeout: 600000,
        removeOnComplete: true
      }
    });

    queues.pdfGeneration = new Bull('pdf-generation', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        timeout: 120000,
        removeOnComplete: true
      }
    });

    queues.emailNotifications = new Bull('email-notifications', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 30000 },
        timeout: 30000,
        removeOnComplete: true
      },
      limiter: { max: 100, duration: 60000 }
    });

    queues.webhookDelivery = new Bull('webhook-delivery', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true
      }
    });

    queues.bulkImport = new Bull('bulk-employee-import', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 1,
        timeout: 1800000,
        removeOnComplete: true
      }
    });

    queues.followUpReminders = new Bull('follow-up-reminders', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        timeout: 30000,
        removeOnComplete: true,
      }
    });

    logger.info('Bull queues created successfully');

    // Register processors
    logger.info('Registering queue processors');

    queues.audioAnalysis.process(5, require('./processors/audioAnalysis'));
    logger.info('Audio analysis processor registered (concurrency: 5)');

    queues.pdfGeneration.process(3, require('./processors/pdfGeneration'));
    logger.info('PDF generation processor registered (concurrency: 3)');

    queues.emailNotifications.process(10, require('./processors/emailNotifications'));
    logger.info('Email notifications processor registered (concurrency: 10)');

    queues.webhookDelivery.process(5, require('./processors/webhookDelivery'));
    logger.info('Webhook delivery processor registered (concurrency: 5)');

    queues.bulkImport.process(2, require('./processors/bulkImport'));
    logger.info('Bulk import processor registered (concurrency: 2)');

    queues.followUpReminders.process(5, require('./processors/followUpReminder'));
    logger.info('Follow-up reminder processor registered (concurrency: 5)');

    // Register cron jobs
    logger.info('Registering cron jobs');

    // Daily assessment reminders at 8 AM IST
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('Executing scheduled assessments cron');
        const result = await require('./processors/scheduledAssessments')();
        logger.info('Scheduled assessments cron completed: %j', result);
      } catch (error) {
        logger.error('Scheduled assessments cron error: %s', error.message);
      }
    }, { timezone: 'Asia/Kolkata' });
    logger.info('Scheduled assessments cron registered (daily at 08:00 Asia/Kolkata)');

    // Weekly HR report on Monday at 9 AM IST
    cron.schedule('0 9 * * 1', async () => {
      try {
        logger.info('Executing weekly HR report cron');
        const result = await require('./processors/weeklyHRReport')();
        logger.info('Weekly HR report cron completed: %j', result);
      } catch (error) {
        logger.error('Weekly HR report cron error: %s', error.message);
      }
    }, { timezone: 'Asia/Kolkata' });
    logger.info('Weekly HR report cron registered (Monday at 09:00 Asia/Kolkata)');

    // Alert escalation every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        logger.info('Executing alert escalation cron');
        const result = await require('./processors/alertEscalation')();
        logger.info('Alert escalation cron completed: %j', result);
      } catch (error) {
        logger.error('Alert escalation cron error: %s', error.message);
      }
    });
    logger.info('Alert escalation cron registered (every 30 minutes)');

    // Audio cleanup every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('Executing audio cleanup cron');
        const result = await require('./processors/audioCleanup')();
        logger.info('Audio cleanup cron completed: %j', result);
      } catch (error) {
        logger.error('Audio cleanup cron error: %s', error.message);
      }
    });
    logger.info('Audio cleanup cron registered (every 5 minutes)');

    // Consultation reminders every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('Executing consultation reminders cron');
        const result = await require('./processors/consultationReminders')();
        logger.info('Consultation reminders cron completed: %j', result);
      } catch (error) {
        logger.error('Consultation reminders cron error: %s', error.message);
      }
    });
    logger.info('Consultation reminders cron registered (every 15 minutes)');

    // Register error handlers for each queue
    logger.info('Registering queue error handlers');

    queues.audioAnalysis.on('failed', (job, err) => {
      logger.error('Job failed: audio-analysis #%s - %s', job.id, err.message);
    });
    queues.audioAnalysis.on('error', err => {
      logger.error('Queue error: audio-analysis - %s', err.message);
    });

    queues.pdfGeneration.on('failed', (job, err) => {
      logger.error('Job failed: pdf-generation #%s - %s', job.id, err.message);
    });
    queues.pdfGeneration.on('error', err => {
      logger.error('Queue error: pdf-generation - %s', err.message);
    });

    queues.emailNotifications.on('failed', (job, err) => {
      logger.error('Job failed: email-notifications #%s - %s', job.id, err.message);
    });
    queues.emailNotifications.on('error', err => {
      logger.error('Queue error: email-notifications - %s', err.message);
    });

    queues.webhookDelivery.on('failed', (job, err) => {
      logger.error('Job failed: webhook-delivery #%s - %s', job.id, err.message);
    });
    queues.webhookDelivery.on('error', err => {
      logger.error('Queue error: webhook-delivery - %s', err.message);
    });

    queues.bulkImport.on('failed', (job, err) => {
      logger.error('Job failed: bulk-employee-import #%s - %s', job.id, err.message);
    });
    queues.bulkImport.on('error', err => {
      logger.error('Queue error: bulk-employee-import - %s', err.message);
    });

    logger.info('Vocalysis Worker Service v2.0 initialized successfully');
    logger.info('Worker is running and ready to process jobs');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await shutdownWorker();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await shutdownWorker();
    });
  } catch (error) {
    logger.error('Worker initialization failed: %s', error.message);
    process.exit(1);
  }
}

async function shutdownWorker() {
  try {
    logger.info('Shutting down worker');

    // Close all queues
    for (const [name, queue] of Object.entries(queues)) {
      if (queue) {
        await queue.close();
        logger.info('Queue closed: %s', name);
      }
    }

    // Disconnect from MongoDB
    await disconnectDB();

    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown: %s', error.message);
    process.exit(1);
  }
}

// Start the worker
initializeWorker();

// Export queues for use in other services/processors
module.exports = { queues };
