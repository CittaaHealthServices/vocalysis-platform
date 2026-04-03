/**
 * InAppNotification — Vocalysis Platform
 *
 * Stores notifications for offline delivery and unread badge counts.
 * Delivered in real-time via SSE when user is connected.
 */

const mongoose = require('mongoose');

const InAppNotificationSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  tenantId:    { type: String, index: true },
  type: {
    type: String,
    enum: [
      'alert', 'pre_alert', 'session_complete', 'approval', 'rejection',
      'nudge', 'consultation_soon', 'report_ready', 'weekly_summary',
      'b2c_registration', 'system',
    ],
    required: true,
  },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  title:    { type: String, required: true },
  body:     { type: String, default: '' },
  payload:  { type: mongoose.Schema.Types.Mixed, default: {} },
  read:       { type: Boolean, default: false },
  readAt:     { type: Date },
  deliveredAt:{ type: Date },
  // Optional link to navigate to when clicked
  actionUrl:  { type: String },
  // Icon/emoji for UI rendering
  icon:       { type: String },
}, {
  timestamps: true,
});

// TTL index: auto-delete read notifications older than 30 days
InAppNotificationSchema.index({ createdAt: 1 }, {
  expireAfterSeconds: 30 * 24 * 60 * 60,
  partialFilterExpression: { read: true },
});

// Compound index for efficient unread queries
InAppNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('InAppNotification', InAppNotificationSchema);
