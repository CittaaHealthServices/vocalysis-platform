require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const mongoose = require('mongoose');
const redis = require('./utils/redis');

const PORT = process.env.PORT || 8080;
// Default to 'production' so a misconfigured Railway deployment is never
// accidentally treated as development (which relaxes error messages, CORS, etc.)
const NODE_ENV = process.env.NODE_ENV || 'production';

let server;
let isShuttingDown = false;

/**
 * Connect to MongoDB
 */
async function connectMongoDB() {
  try {
    // useNewUrlParser and useUnifiedTopology are deprecated in Mongoose 6+
    // and have no effect — the new driver uses them by default.
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vocalysis');
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('Failed to connect to MongoDB', { error: err.message });
    // Do not exit — allow server to keep running so /health stays responsive
  }
}

/**
 * Verify Redis connection
 */
async function verifyRedis() {
  try {
    await redis.ping();
    logger.info('Connected to Redis');
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: err.message });
    // Do not exit — allow server to keep running so /health stays responsive
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Set shutdown timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Disconnect MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

    // Close Redis connection
    await redis.quit();
    logger.info('Closed Redis connection');

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Start server
 */
async function startServer() {
  // Create and start HTTP server immediately so /health responds right away
  server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`Vocalysis Platform API Server listening on port ${PORT}`, {
      environment: NODE_ENV,
      nodeVersion: process.version
    });
  });

  // Handle server errors
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
    } else {
      logger.error('Server error', { error: err.message });
    }
    process.exit(1);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', {
      promise,
      reason: String(reason)
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      error: err.message,
      stack: err.stack
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Connect to databases in the background (after HTTP server is up)
  connectMongoDB().then(() => seedAdmin()).catch((err) => {
    logger.error('Background MongoDB connection failed', { error: err.message });
  });
  verifyRedis().catch((err) => {
    logger.error('Background Redis connection failed', { error: err.message });
  });
}

/**
 * Seed the first CITTAA_SUPER_ADMIN when SEED_ADMIN=true is set.
 * Safe: only creates the user if no super-admin exists yet.
 */
async function seedAdmin() {
  if (process.env.SEED_ADMIN !== 'true') return;
  try {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const db = mongoose.connection.db;
    const tenantsCol = db.collection('tenants');
    const usersCol   = db.collection('users');

    const TENANT_ID      = process.env.SEED_TENANT_ID      || 'cittaa-platform';
    const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@cittaa.in';
    const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Cittaa@Admin2026!';

    // Upsert platform tenant
    await tenantsCol.updateOne(
      { tenantId: TENANT_ID },
      { $setOnInsert: {
          tenantId: TENANT_ID,
          displayName: 'Cittaa Health Services',
          legalName: 'Cittaa Health Services Pvt Ltd',
          type: 'clinic',
          industry: 'Mental Health',
          status: 'active',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    );

    // Hash password
    const salt         = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

    // Upsert super-admin user
    const existing = await usersCol.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      await usersCol.updateOne(
        { email: ADMIN_EMAIL },
        { $set: { passwordHash, salt, isActive: true, isEmailVerified: true, updatedAt: new Date(), role: 'CITTAA_SUPER_ADMIN' } }
      );
      logger.info('SEED: Super-admin password reset', { email: ADMIN_EMAIL });
    } else {
      await usersCol.insertOne({
        userId: uuidv4(),
        tenantId: TENANT_ID,
        email: ADMIN_EMAIL,
        passwordHash,
        salt,
        role: 'CITTAA_SUPER_ADMIN',
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        isEmailVerified: true,
        emailVerified: true,
        status: 'active',
        loginAttempts: 0,
        mfaEnabled: false,
        consentRecord: { consentGiven: true, consentDate: new Date(), consentVersion: '1.0', dataProcessingConsent: true, researchConsent: false },
        notificationPreferences: { emailAlerts: true, inAppAlerts: true, whatsappAlerts: false, alertOnHighRisk: true, alertOnAssessmentComplete: true, weeklyReport: false },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info('SEED: Super-admin created', { email: ADMIN_EMAIL });
    }
    logger.info('✅ SEED complete — admin ready', { email: ADMIN_EMAIL });
  } catch (err) {
    logger.error('SEED failed', { error: err.message });
  }
}

// Start the server
startServer();

module.exports = server;
