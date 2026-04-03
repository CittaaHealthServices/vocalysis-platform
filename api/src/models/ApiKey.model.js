const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    keyId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    keyHash: {
      type: String,
      unique: true,
      index: true,
      required: true,
      select: false,
    },
    keyHashPrefix: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastUsedAt: Date,
    lastUsedIp: String,
    expiresAt: Date,
    rateLimit: {
      perMinute: {
        type: Number,
        default: 60,
        min: 1,
      },
      perDay: {
        type: Number,
        default: 10000,
        min: 1,
      },
    },
    permissions: {
      allowedEndpoints: [String],
      allowedMethods: {
        type: [String],
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      },
    },
    ipWhitelist: [String],
    webhook: {
      enabled: { type: Boolean, default: false },
      url: String,
      events: [String],
    },
    usageStats: {
      totalRequests: {
        type: Number,
        default: 0,
      },
      totalBytesReceived: {
        type: Number,
        default: 0,
      },
      totalBytesSent: {
        type: Number,
        default: 0,
      },
      lastReset: Date,
    },
    metadata: {
      environment: {
        type: String,
        enum: ['development', 'staging', 'production'],
        default: 'production',
      },
      applicationName: String,
      contactEmail: String,
    },
    revokedAt: Date,
    revokationReason: String,
    revokedBy: String,
  },
  {
    timestamps: true,
  }
);

apiKeySchema.index({ keyHash: 1 }, { unique: true });
apiKeySchema.index({ tenantId: 1, isActive: 1 });

apiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};

apiKeySchema.statics.getKeyPrefix = function (rawKey) {
  return rawKey.substring(0, 8);
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
