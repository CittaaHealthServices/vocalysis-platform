const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const healthCheckLogSchema = new mongoose.Schema(
  {
    healthCheckId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    service: {
      type: String,
      enum: ['mongodb', 'redis', 'vocoware', 'google_oauth', 'email_service', 'api_server'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'unhealthy'],
      required: true,
    },
    responseTime: Number,
    details: {
      message: String,
      errorCode: String,
      lastFailure: Date,
      consecutiveFailures: {
        type: Number,
        default: 0,
      },
    },
    metrics: {
      uptime: Number,
      connectionPoolSize: Number,
      activeConnections: Number,
      queuedRequests: Number,
      averageResponseTime: Number,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

healthCheckLogSchema.index({ service: 1, checkedAt: -1 });
healthCheckLogSchema.index({ status: 1, checkedAt: -1 });

module.exports = mongoose.model('HealthCheckLog', healthCheckLogSchema);
