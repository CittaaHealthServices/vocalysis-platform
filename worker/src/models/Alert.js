const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employeeId: mongoose.Schema.Types.ObjectId,
  sessionId: mongoose.Schema.Types.ObjectId,
  employeeName: String,
  type: { type: String, enum: ['critical_risk', 'high_risk', 'medium_risk', 'low_risk'] },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
  message: String,
  analysisResult: mongoose.Schema.Types.Mixed,
  triggeredAt: { type: Date, default: Date.now },
  escalatedAt: Date,
  status: { type: String, enum: ['new', 'acknowledged', 'escalated', 'resolved'], default: 'new' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

alertSchema.index({ tenantId: 1, status: 1 });
alertSchema.index({ employeeId: 1, triggeredAt: -1 });
alertSchema.index({ triggeredAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
