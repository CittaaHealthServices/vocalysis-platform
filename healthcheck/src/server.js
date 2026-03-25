require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const mongoose = require('mongoose');
const path = require('path');
const logger = require('./logger');
const { sendDegradationAlert, sendRecoveryAlert } = require('./alerter');

// Import health check functions
const apiCheck = require('./checks/apiCheck');
const vococoreCheck = require('./checks/vococoreCheck');
const databaseCheck = require('./checks/databaseCheck');
const redisCheck = require('./checks/redisCheck');
const workerCheck = require('./checks/workerCheck');

const app = express();
const port = process.env.PORT || 8080;

// In-memory state tracking
let serviceStatuses = {
  api: { status: 'unknown', lastCheck: null, responseTimeMs: 0 },
  vococore: { status: 'unknown', lastCheck: null, responseTimeMs: 0 },
  database: { status: 'unknown', lastCheck: null, responseTimeMs: 0 },
  redis: { status: 'unknown', lastCheck: null, latencyMs: 0 },
  worker: { status: 'unknown', lastCheck: null, totalWaiting: 0, totalActive: 0, totalFailed: 0 }
};

let serviceHistory = {}; // Track status changes for uptime calculation

// Initialize service history
Object.keys(serviceStatuses).forEach(service => {
  serviceHistory[service] = {
    checks: [],
    uptime90days: 100
  };
});

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vocalysis-prod';

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    });

    logger.info('MongoDB connected for healthcheck service');
  } catch (error) {
    logger.warn('MongoDB connection not available (optional for healthcheck): %s', error.message);
    // Continue without MongoDB - some checks may be skipped
  }
}

// Run all health checks
async function runHealthChecks() {
  logger.debug('Running health checks');

  try {
    // Run all checks in parallel
    const [apiResult, vococoreResult, dbResult, redisResult, workerResult] = await Promise.all([
      apiCheck().catch(err => ({ service: 'api', status: 'error', error: err.message })),
      vococoreCheck().catch(err => ({ service: 'vococore', status: 'error', error: err.message })),
      databaseCheck().catch(err => ({ service: 'database', status: 'error', error: err.message })),
      redisCheck().catch(err => ({ service: 'redis', status: 'error', error: err.message })),
      workerCheck().catch(err => ({ service: 'worker', status: 'error', error: err.message }))
    ]);

    // Process results
    const results = [apiResult, vococoreResult, dbResult, redisResult, workerResult];

    for (const result of results) {
      const service = result.service;
      const previousStatus = serviceStatuses[service].status;
      const currentStatus = result.status === 'error' ? 'down' : result.status;

      // Update status
      serviceStatuses[service] = {
        status: currentStatus,
        lastCheck: new Date(),
        responseTimeMs: result.responseTimeMs || result.latencyMs || 0,
        totalWaiting: result.totalWaiting,
        totalActive: result.totalActive,
        totalFailed: result.totalFailed,
        memoryUsageMb: result.memoryUsageMb,
        error: result.error
      };

      // Track in history
      if (!serviceHistory[service].checks) {
        serviceHistory[service].checks = [];
      }
      serviceHistory[service].checks.push({
        status: currentStatus,
        timestamp: new Date(),
        responseTime: result.responseTimeMs || result.latencyMs || 0
      });

      // Keep only last 1000 checks per service (90+ days)
      if (serviceHistory[service].checks.length > 1000) {
        serviceHistory[service].checks = serviceHistory[service].checks.slice(-1000);
      }

      // Check for status change
      if (previousStatus !== 'unknown' && previousStatus !== currentStatus) {
        logger.warn('Service %s status changed from %s to %s', service, previousStatus, currentStatus);

        if (currentStatus === 'healthy' && previousStatus !== 'healthy') {
          // Recovered
          await sendRecoveryAlert({ service });
        } else if (currentStatus !== 'healthy' && previousStatus === 'healthy') {
          // Degradation or outage
          await sendDegradationAlert({
            service,
            status: currentStatus,
            error: result.error,
            responseTime: result.responseTimeMs || result.latencyMs
          });
        }
      }

      logger.debug('Health check completed for %s: %s', service, currentStatus);
    }

    // Log to MongoDB if available
    if (mongoose.connection.readyState === 1) {
      try {
        const HealthCheckLog = mongoose.model('HealthCheckLog', new mongoose.Schema({
          service: String,
          status: String,
          responseTime: Number,
          timestamp: { type: Date, default: Date.now },
          details: mongoose.Schema.Types.Mixed
        }, { collection: 'healthcheck_logs' }));

        await HealthCheckLog.insertMany(
          results.map(r => ({
            service: r.service,
            status: r.status,
            responseTime: r.responseTimeMs || r.latencyMs || 0,
            details: { error: r.error }
          }))
        );
      } catch (err) {
        logger.debug('Failed to log health checks to MongoDB: %s', err.message);
      }
    }
  } catch (error) {
    logger.error('Error running health checks: %s', error.message);
  }
}

// Calculate overall status
function getOverallStatus() {
  const statuses = Object.values(serviceStatuses).map(s => s.status);

  if (statuses.includes('down')) {
    return 'down';
  } else if (statuses.includes('degraded')) {
    return 'degraded';
  } else if (statuses.every(s => s === 'healthy' || s === 'unknown')) {
    return 'healthy';
  } else {
    return 'unknown';
  }
}

// Calculate uptime percentage
function calculateUptime(service) {
  const checks = serviceHistory[service].checks || [];
  if (checks.length === 0) return 100;

  const healthyChecks = checks.filter(c => c.status === 'healthy').length;
  return (healthyChecks / checks.length) * 100;
}

// Routes
app.use(express.static(path.join(__dirname, 'statusPage')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'statusPage', 'index.html'));
});

app.get('/status', (req, res) => {
  const response = {
    overallStatus: getOverallStatus(),
    timestamp: new Date(),
    services: {}
  };

  // Build services response
  for (const [service, status] of Object.entries(serviceStatuses)) {
    response.services[service] = {
      status: status.status,
      responseTimeMs: status.responseTimeMs || 0,
      uptime: calculateUptime(service) / 100,
      lastCheck: status.lastCheck,
      error: status.error
    };

    // Add queue stats for worker
    if (service === 'worker' && status.totalWaiting !== undefined) {
      response.services[service].queueStats = {
        totalWaiting: status.totalWaiting,
        totalActive: status.totalActive,
        totalFailed: status.totalFailed
      };
    }
  }

  res.json(response);
});

app.get('/status/history', async (req, res) => {
  const service = req.query.service || 'api';
  const hours = parseInt(req.query.hours || '24');

  if (!serviceHistory[service]) {
    return res.status(400).json({ error: 'Invalid service' });
  }

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  const checks = serviceHistory[service].checks.filter(c => c.timestamp > cutoffTime);

  res.json({
    service,
    hours,
    checks,
    uptime: (checks.filter(c => c.status === 'healthy').length / checks.length * 100).toFixed(2)
  });
});

app.get('/incidents', (req, res) => {
  // This would typically fetch from a database of incidents
  // For now, return empty array
  res.json({
    active: [],
    recent: []
  });
});

app.get('/health', (req, res) => {
  // Endpoint for the healthcheck service itself to respond
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error: %s', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    logger.info('Initializing Vocalysis Healthcheck Service v2.0');

    // Connect to MongoDB (optional)
    await connectDB();

    // Run initial health checks
    await runHealthChecks();

    // Schedule health checks every 60 seconds
    cron.schedule('* * * * *', async () => {
      try {
        await runHealthChecks();
      } catch (error) {
        logger.error('Scheduled health check failed: %s', error.message);
      }
    });

    logger.info('Health check scheduler started (every 60 seconds)');

    // Start Express server
    app.listen(port, () => {
      logger.info('Vocalysis Healthcheck Service running on port %d', port);
      logger.info('Status page available at http://localhost:%d/', port);
    });
  } catch (error) {
    logger.error('Failed to start healthcheck service: %s', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
