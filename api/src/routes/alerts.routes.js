const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const alertEngine = require('../services/alertEngine');

/**
 * GET /alerts
 * List alerts (role-scoped)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, alertLevel } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      alertLevel: alertLevel || null,
      status: status || null
    };

    // If employee, only show their own alerts
    if (userRole === 'EMPLOYEE') {
      filters.employeeId = userId;
    }

    const result = await alertEngine.getActiveAlerts(tenantId, filters);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'ALERTS_LISTED',
      targetResource: 'Alert',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json(result);
  } catch (err) {
    logger.error('Failed to list alerts', { error: err.message });
    res.status(500).json({ error: 'Failed to list alerts' });
  }
});

/**
 * GET /alerts/stats
 * Get alert statistics
 */
router.get('/stats', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const requestId = req.requestId;

    const stats = await alertEngine.getAlertStats(tenantId);

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'ALERT_STATS_VIEWED',
      targetResource: 'Alert',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ stats });
  } catch (err) {
    logger.error('Failed to get alert statistics', { error: err.message });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /alerts/:id
 * Get alert detail
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const alert = await Alert.findById(id)
      .populate('employeeId', 'firstName lastName email')
      .populate('sessionId', 'vocacoreResults createdAt')
      .populate('acknowledgedBy', 'firstName lastName')
      .populate('escalatedTo', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Check authorization
    if (alert.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (userRole === 'EMPLOYEE' && alert.employeeId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'ALERT_VIEWED',
      targetResource: 'Alert',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ alert });
  } catch (err) {
    logger.error('Failed to fetch alert', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

/**
 * PUT /alerts/:id/acknowledge
 * Acknowledge alert
 */
router.put('/:id/acknowledge', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedAlert = await alertEngine.acknowledgeAlert(id, userId, note);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'ALERT_ACKNOWLEDGED',
      targetResource: 'Alert',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { note }
    });

    res.json({ message: 'Alert acknowledged', alert: updatedAlert });
  } catch (err) {
    logger.error('Failed to acknowledge alert', { error: err.message });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * PUT /alerts/:id/escalate
 * Escalate alert to higher authority
 */
router.put('/:id/escalate', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { escalatedTo, reason } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    if (!escalatedTo || !reason) {
      return res.status(400).json({ error: 'escalatedTo and reason required' });
    }

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify escalatedTo user exists
    const escalateToUser = await User.findById(escalatedTo);
    if (!escalateToUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const updatedAlert = await alertEngine.escalateAlert(id, escalatedTo, reason);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'ALERT_ESCALATED',
      targetResource: 'Alert',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { escalatedTo, reason }
    });

    res.json({ message: 'Alert escalated', alert: updatedAlert });
  } catch (err) {
    logger.error('Failed to escalate alert', { error: err.message });
    res.status(500).json({ error: 'Failed to escalate alert' });
  }
});

/**
 * PUT /alerts/:id/resolve
 * Resolve alert
 */
router.put('/:id/resolve', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionSummary } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    if (!resolutionSummary) {
      return res.status(400).json({ error: 'resolutionSummary required' });
    }

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedAlert = await alertEngine.resolveAlert(id, userId, resolutionSummary);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'ALERT_RESOLVED',
      targetResource: 'Alert',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { resolutionSummary }
    });

    res.json({ message: 'Alert resolved', alert: updatedAlert });
  } catch (err) {
    logger.error('Failed to resolve alert', { error: err.message });
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

module.exports = router;
