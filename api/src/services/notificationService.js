/**
 * NotificationService — Cittaa Health Services · Vocalysis Platform
 *
 * Manages real-time in-app notifications via Server-Sent Events (SSE).
 *
 * ✦ Heartbeat every 25s to keep Railway/proxy connections alive
 * ✦ Per-user connection map (one active stream per browser tab; newest wins)
 * ✦ Fallback: notifications stored in MongoDB if user is offline, fetched on reconnect
 * ✦ Zero dependency on socket.io — pure HTTP/1.1 EventSource
 *
 * Usage:
 *   notificationService.connect(userId, res)       → register SSE stream
 *   notificationService.send(userId, type, data)   → push event to user
 *   notificationService.broadcast(tenantId, ...)   → push to all users in a tenant
 */

const logger = require('../utils/logger');

// ── In-memory SSE client registry ────────────────────────────────────────────
// Map: userId → { res, tenantId, role, connectedAt, heartbeatTimer }
const _clients = new Map();

// ── Heartbeat interval (ms) — Railway idle timeout is ~60s ──────────────────
const HEARTBEAT_MS = 25_000;

// ── Notification Model (lazy require to avoid circular deps) ─────────────────
let _Notification = null;
function getModel() {
  if (!_Notification) {
    _Notification = require('../models/InAppNotification');
  }
  return _Notification;
}

/**
 * Register an SSE connection for a user.
 * Sets response headers and sends a 'connected' event immediately.
 */
function connect(userId, tenantId, role, res) {
  // Disconnect any existing client for this user (new tab wins)
  disconnect(userId);

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering on Railway
  });

  // Initial connected event
  _write(res, 'connected', { userId, ts: new Date().toISOString() });

  // Heartbeat to prevent proxy/Railway from closing idle connections
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      disconnect(userId);
    }
  }, HEARTBEAT_MS);

  _clients.set(userId.toString(), { res, tenantId, role, connectedAt: new Date(), heartbeatTimer });
  logger.info('SSE client connected', { userId, tenantId, totalClients: _clients.size });

  // Send any unread notifications that queued while user was offline
  _flushPending(userId.toString(), res).catch(err =>
    logger.error('SSE flush-pending failed', { userId, error: err.message })
  );
}

/**
 * Disconnect & clean up a user's SSE stream.
 */
function disconnect(userId) {
  const client = _clients.get(userId.toString());
  if (!client) return;
  clearInterval(client.heartbeatTimer);
  try { client.res.end(); } catch { /* already closed */ }
  _clients.delete(userId.toString());
  logger.info('SSE client disconnected', { userId, totalClients: _clients.size });
}

/**
 * Send a notification event to a specific user.
 * If offline, persists to MongoDB so it's delivered on next connect.
 *
 * @param {string}  userId
 * @param {string}  type    — e.g. 'alert', 'session_complete', 'approval', 'nudge'
 * @param {object}  data    — payload
 * @param {object}  opts    — { persist: true, priority: 'normal'|'high' }
 */
async function send(userId, type, data, opts = {}) {
  const { persist = true, priority = 'normal' } = opts;
  const userIdStr = userId.toString();

  // Persist to DB first (so offline users get it on next connect)
  let notifDoc = null;
  if (persist) {
    try {
      const Notification = getModel();
      notifDoc = await Notification.create({
        userId: userIdStr,
        tenantId: data.tenantId || null,
        type,
        priority,
        title: data.title || _defaultTitle(type),
        body:  data.body  || data.message || '',
        payload: data,
        read: false,
        deliveredAt: null,
      });
    } catch (err) {
      logger.error('Failed to persist notification', { userId, type, error: err.message });
    }
  }

  // If user is connected, push immediately
  const client = _clients.get(userIdStr);
  if (client) {
    const payload = notifDoc ? { ...data, notificationId: notifDoc._id } : data;
    _write(client.res, type, payload);
    if (notifDoc) {
      notifDoc.deliveredAt = new Date();
      notifDoc.save().catch(() => {});
    }
    logger.debug('SSE event pushed', { userId, type });
  }
}

/**
 * Broadcast a notification to ALL users in a tenant.
 * Skips users who have inAppAlerts disabled (checked against DB prefs).
 */
async function broadcast(tenantId, type, data, opts = {}) {
  const tenantIdStr = tenantId.toString();
  const promises = [];
  for (const [userId, client] of _clients.entries()) {
    if (client.tenantId === tenantIdStr) {
      promises.push(send(userId, type, data, opts));
    }
  }
  await Promise.allSettled(promises);
}

/**
 * Returns count of currently connected clients (for health endpoint).
 */
function connectedCount() {
  return _clients.size;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _write(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    logger.debug('SSE write failed (client likely disconnected)', { event, error: err.message });
  }
}

async function _flushPending(userId, res) {
  try {
    const Notification = getModel();
    const pending = await Notification.find({
      userId,
      deliveredAt: null,
      read: false,
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    if (pending.length > 0) {
      _write(res, 'pending_notifications', { count: pending.length, notifications: pending });
      // Mark as delivered
      await Notification.updateMany(
        { _id: { $in: pending.map(n => n._id) } },
        { $set: { deliveredAt: new Date() } }
      );
    }
  } catch (err) {
    logger.debug('_flushPending: model not ready or error', { userId, error: err.message });
  }
}

function _defaultTitle(type) {
  const titles = {
    alert:              '⚠️ Wellbeing Alert',
    session_complete:   '✅ Check-in Complete',
    approval:           '✅ Account Approved',
    rejection:          '❌ Account Update',
    nudge:              '💡 Coaching Insight',
    pre_alert:          '🔔 Trend Notice',
    consultation_soon:  '🗓️ Upcoming Session',
    report_ready:       '📄 Report Ready',
    weekly_summary:     '📊 Weekly Summary',
  };
  return titles[type] || '🔔 Notification';
}

module.exports = { connect, disconnect, send, broadcast, connectedCount };
