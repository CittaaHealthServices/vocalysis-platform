/**
 * Notifications Routes — Cittaa Health Services · Vocalysis Platform
 *
 * GET  /notifications/stream         — SSE stream (keep-alive, EventSource)
 * GET  /notifications                — list recent notifications (REST fallback)
 * GET  /notifications/unread-count   — badge count for bell icon
 * PATCH /notifications/:id/read      — mark single notification read
 * PATCH /notifications/read-all      — mark all as read
 * DELETE /notifications/:id          — dismiss a notification
 */

const express          = require('express');
const router           = express.Router();
const { requireAuth }  = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const InAppNotification   = require('../models/InAppNotification');
const logger           = require('../utils/logger');

// ── SSE Stream ────────────────────────────────────────────────────────────────

/**
 * GET /notifications/stream
 * Opens a persistent SSE connection for the authenticated user.
 * Client should use: const es = new EventSource('/notifications/stream', { withCredentials: true })
 */
router.get('/stream', requireAuth, (req, res) => {
  const userId   = (req.user.userId || req.user._id).toString();
  const tenantId = req.user.tenantId;
  const role     = req.user.role;

  // Register SSE connection
  notificationService.connect(userId, tenantId, role, res);

  // Clean up on client disconnect
  req.on('close', () => {
    notificationService.disconnect(userId);
  });
  req.on('aborted', () => {
    notificationService.disconnect(userId);
  });
});

// ── REST Fallback ─────────────────────────────────────────────────────────────

/**
 * GET /notifications
 * Returns last 50 notifications (for REST polling fallback + notification panel).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const { page = 1, limit = 50, unreadOnly } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { userId };
    if (unreadOnly === 'true') filter.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      InAppNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      InAppNotification.countDocuments(filter),
      InAppNotification.countDocuments({ userId, read: false }),
    ]);

    res.json({ success: true, data: notifications, meta: { total, unreadCount, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    logger.error('GET /notifications failed', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch notifications' } });
  }
});

/**
 * GET /notifications/unread-count
 * Lightweight endpoint for the bell icon badge.
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const count  = await InAppNotification.countDocuments({ userId, read: false });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

/**
 * PATCH /notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const notif = await InAppNotification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * PATCH /notifications/read-all
 * Mark all of the user's notifications as read.
 */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const result = await InAppNotification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ success: true, updatedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * DELETE /notifications/:id
 * Dismiss (delete) a single notification.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    await InAppNotification.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
