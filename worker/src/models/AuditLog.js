const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  action: String,
  resourceType: String,
  resourceId: mongoose.Schema.Types.ObjectId,
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  details: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now, index: true }
});

auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
