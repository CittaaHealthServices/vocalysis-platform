const mongoose = require('mongoose');

const webhookDeliveryLogSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  event: String,
  webhookUrl: String,
  attempt: Number,
  status: { type: String, enum: ['success', 'failed', 'timeout'] },
  statusCode: Number,
  responseTime: Number,
  signature: String,
  error: String,
  finalStatus: { type: String, enum: ['success', 'failed_permanent', 'pending_retry'] },
  timestamp: { type: Date, default: Date.now }
});

webhookDeliveryLogSchema.index({ tenantId: 1, event: 1 });
webhookDeliveryLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema);
