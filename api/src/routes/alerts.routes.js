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
    const userId = (req.user.userId || req.user._id);
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
 * GET /alerts/stats  ← must be BEFORE /:id so it isn't shadowed
 * Get alert statistics
 */
router.get('/stats', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;
    const stats = await alertEngine.getAlertStats(tenantId);
    await auditService.log({ userId, tenantId, role: req.user.role, action: 'ALERT_STATS_VIEWED', targetResource: 'Alert', ipAddress: req.ip, userAgent: req.get('user-agent'), requestId });
    res.json({ stats });
  } catch (err) {
    logger.error('Failed to get alert statistics', { error: err.message });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * PATCH /alerts/:id
 * Generic status update — frontend sends { status: 'acknowledged'|'escalated'|'resolved' }
 */
router.patch('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const userId = (req.user.userId || req.user._id);
    const tenantId = req.user.tenantId;

    const alert = await Alert.findOne({ _id: id, tenantId });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const now = new Date();
    if (status === 'acknowledged') {
      alert.status = 'acknowledged'; alert.acknowledgedAt = now; alert.acknowledgedBy = userId;
      if (note) alert.acknowledgeNote = note;
    } else if (status === 'escalated') {
      alert.status = 'escalated'; alert.escalatedAt = now;
    } else if (status === 'resolved') {
      alert.status = 'resolved'; alert.resolvedAt = now; alert.resolvedBy = userId;
      if (note) alert.resolutionNote = note;
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await alert.save();
    res.json({ alert });
  } catch (err) {
    logger.error('Failed to update alert', { error: err.message });
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

/**
 * GET /alerts/:id
 * Get alert detail
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user.userId || req.user._id);
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
router.put('/:id/acknowledge', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req.user.userId || req.user._id);
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
    const userId = (req.user.userId || req.user._id);
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
 * PUT /alerts/:id/assign
 * Assign one or more psychologists to an alert / escalated case.
 * Access: HR_ADMIN, COMPANY_ADMIN, CITTAA_SUPER_ADMIN, CITTAA_CEO
 */
router.put('/:id/assign', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CITTAA_SUPER_ADMIN', 'CITTAA_CEO']), async (req, res) => {
  try {
    const { id }             = req.params;
    const { psychologistIds, note } = req.body;
    const userId   = (req.user.userId || req.user._id);
    const tenantId = req.user.tenantId;

    if (!psychologistIds || !Array.isArray(psychologistIds) || psychologistIds.length === 0) {
      return res.status(400).json({ error: 'psychologistIds array is required' });
    }

    const alert = await Alert.findOne({ _id: id, tenantId });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    // Validate all psychologist IDs exist and have correct role
    const psychologists = await User.find({
      _id: { $in: psychologistIds },
      role: { $in: ['SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'] },
    }).select('firstName lastName email role').lean();

    if (psychologists.length === 0) {
      return res.status(400).json({ error: 'No valid psychologists found for provided IDs' });
    }

    // Merge with existing assignedTo (avoid duplicates)
    const existingSet = new Set((alert.assignedTo || []).map(String));
    psychologists.forEach(p => existingSet.add(p._id.toString()));
    alert.assignedTo = Array.from(existingSet);

    // Also escalate if not already
    if (alert.status === 'new') {
      alert.status       = 'escalated';
      alert.escalatedAt  = new Date();
      alert.escalationReason = note || 'Psychologist assigned';
    }

    await alert.save();

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'ALERT_PSYCHOLOGIST_ASSIGNED',
      targetResource: 'Alert',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      changeSnapshot: { assignedTo: psychologists.map(p => p.email), note },
    });

    res.json({
      message:         `Assigned ${psychologists.length} psychologist(s) to this case`,
      alert,
      assignedProfiles: psychologists,
    });
  } catch (err) {
    logger.error('Failed to assign psychologist to alert', { error: err.message });
    res.status(500).json({ error: 'Failed to assign psychologist' });
  }
});

/**
 * GET /alerts/escalated
 * Get all escalated alerts with assigned psychologist details.
 * Access: COMPANY_ADMIN, HR_ADMIN, CITTAA_SUPER_ADMIN, CITTAA_CEO
 */
router.get('/escalated', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const tenantId  = req.user.tenantId;
    const userId    = (req.user.userId || req.user._id);
    const userRole  = req.user.role;
    const { page = 1, limit = 20 } = req.query;

    let query = { tenantId, status: { $in: ['escalated', 'in_progress'] } };

    // Psychologists only see cases assigned to them
    if (['SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'].includes(userRole)) {
      query.assignedTo = { $in: [userId.toString()] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ triggeredAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Alert.countDocuments(query),
    ]);

    // Enrich with employee and assignee names
    const enriched = await Promise.all(alerts.map(async (a) => {
      const [employee, assignees] = await Promise.all([
        User.findById(a.employeeId).select('firstName lastName email department').lean().catch(() => null),
        a.assignedTo?.length
          ? User.find({ _id: { $in: a.assignedTo } }).select('firstName lastName email role').lean().catch(() => [])
          : [],
      ]);
      return {
        ...a,
        employeeName:  employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
        employeeEmail: employee?.email,
        department:    employee?.department,
        assignees,
      };
    }));

    res.json({
      success: true,
      data: { alerts: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    logger.error('Failed to list escalated alerts', { error: err.message });
    res.status(500).json({ error: 'Failed to list escalated alerts' });
  }
});

/**
 * PUT /alerts/:id/resolve
 * Resolve alert
 */
router.put('/:id/resolve', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionSummary } = req.body;
    const userId = (req.user.userId || req.user._id);
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
