const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const alertSchema = new mongoose.Schema(
  {
    alertId: {
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
    employeeId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      ref: 'Session',
    },
    alertLevel: {
      type: String,
      enum: ['high', 'critical'],
    },
    triggeringScores: [String],
    alertType: {
      type: String,
      enum: [
        'high_risk_detected',
        'risk_escalation',
        'missed_assessment',
        'intervention_needed',
        'crisis_alert',
        'consent_expired',
        'data_issue',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    status: {
      type: String,
      enum: ['new', 'active', 'acknowledged', 'in_progress', 'resolved', 'escalated'],
      default: 'new',
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    riskDetails: {
      riskLevel: {
        type: String,
        enum: ['green', 'yellow', 'orange', 'red'],
      },
      riskScore: Number,
      previousRiskLevel: String,
      changePercentage: Number,
      dimensionalScores: {
        depression: Number,
        anxiety: Number,
        stress: Number,
        burnout: Number,
        engagement: Number,
      },
    },
    assignedTo: [String],
    acknowledgedBy: {
      type: String,
      ref: 'User',
    },
    acknowledgedAt: Date,
    acknowledgementNote: String,
    resolvedBy: {
      type: String,
      ref: 'User',
    },
    resolvedAt: Date,
    resolutionNotes: String,
    resolutionSummary: String,
    escalatedTo: [
      {
        type: String,
        ref: 'User',
      },
    ],
    escalatedAt: Date,
    escalationReason: String,
    notificationChannels: {
      email: { type: Boolean, default: false },
      inApp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      dashboard: { type: Boolean, default: false },
    },
    relatedAlertIds: [String],
    metadata: {
      source: String,
      triggerThreshold: String,
      previousAlertDate: Date,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ tenantId: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ tenantId: 1, employeeId: 1 });

module.exports = mongoose.model('Alert', alertSchema);
