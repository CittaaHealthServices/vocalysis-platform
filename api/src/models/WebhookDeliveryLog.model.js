const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const webhookDeliveryLogSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    webhookUrl: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        'session.created',
        'session.updated',
        'session.completed',
        'assessment.completed',
        'alert.triggered',
        'alert.resolved',
        'employee.imported',
        'employee.updated',
        'employee.offboarded',
        'consultation.scheduled',
        'consultation.completed',
        'consultation.cancelled',
        'consent.granted',
        'consent.withdrawn',
        'user.created',
        'user.updated',
      ],
      required: true,
      index: true,
    },
    payload: mongoose.Schema.Types.Mixed,
    payloadSize: Number,
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'retrying'],
      default: 'pending',
      index: true,
    },
    httpStatusCode: Number,
    responseBody: String,
    responseTime: Number,
    attempts: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 5,
    },
    nextRetryAt: Date,
    lastAttemptAt: Date,
    firstAttemptAt: {
      type: Date,
      default: Date.now,
    },
    successfulDeliveryAt: Date,
    errorDetails: {
      message: String,
      code: String,
      stack: String,
    },
    headers: {
      'x-vocalysis-event': String,
      'x-vocalysis-delivery-id': String,
      'x-vocalysis-timestamp': String,
      'x-vocalysis-signature': String,
    },
    metadata: {
      sessionId: String,
      employeeId: String,
      userId: String,
      alertId: String,
      consultationId: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

webhookDeliveryLogSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
webhookDeliveryLogSchema.index({ deliveryStatus: 1, nextRetryAt: 1 });
webhookDeliveryLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema);
