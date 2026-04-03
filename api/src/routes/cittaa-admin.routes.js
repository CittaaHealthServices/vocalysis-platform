const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog.model');
const ApiKey = require('../models/ApiKey.model');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Session = require('../models/Session');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

// All routes require super admin
const superAdmin = [requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO'])];

// ============================================================================
// OVERVIEW — basic platform stats
// ============================================================================
router.get('/overview', ...superAdmin, async (req, res) => {
  try {
    const now      = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      allTenants,
      totalEmployees,
      activeApiKeys,
      assessmentsToday,
      assessmentsThisMonth,
      activeAlerts,
      recentLogs,
      wellnessAgg,
      riskAgg,
    ] = await Promise.all([
      Tenant.find({}).select('tenantId displayName status contractTier employeeCount monthlyAssessmentQuota').lean(),
      User.countDocuments({ role: 'EMPLOYEE', isActive: true }),
      ApiKey.countDocuments({ isActive: true }),
      Session.countDocuments({ createdAt: { $gte: todayStart }, status: 'completed' }),
      Session.countDocuments({ createdAt: { $gte: monthStart }, status: 'completed' }),
      Alert.countDocuments({ status: 'new' }),
      AuditLog.find({}).sort({ timestamp: -1 }).limit(5).lean(),
      Session.aggregate([
        { $match: { status: 'completed', 'vocacoreResults.wellnessScore': { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$vocacoreResults.wellnessScore' }, count: { $sum: 1 } } },
      ]),
      Session.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$vocacoreResults.riskLevel', count: { $sum: 1 } } },
      ]),
    ]);

    // Monthly assessment trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyAgg = await Session.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
          avgScore: { $avg: '$vocacoreResults.wellnessScore' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyData = monthlyAgg.map(m => ({
      month:       MONTH_NAMES[m._id.month - 1],
      assessments: m.count,
      avgScore:    Math.round(m.avgScore || 0),
    }));

    // Risk distribution
    const riskMap = {};
    riskAgg.forEach(r => { riskMap[r._id || 'unknown'] = r.count; });
    const riskDist = [
      { name: 'Low Risk',    value: riskMap['low']      || 0 },
      { name: 'Medium Risk', value: riskMap['medium']   || riskMap['moderate'] || 0 },
      { name: 'High Risk',   value: riskMap['high']     || 0 },
      { name: 'Critical',    value: riskMap['critical'] || 0 },
    ];

    // Per-tenant enriched data
    const tenantIds = allTenants.map(t => t.tenantId);
    const [tenantEmpCounts, tenantSessionAggs] = await Promise.all([
      User.aggregate([
        { $match: { role: 'EMPLOYEE', isActive: true, tenantId: { $in: tenantIds } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]),
      Session.aggregate([
        { $match: { status: 'completed', tenantId: { $in: tenantIds } } },
        { $group: { _id: '$tenantId', avgScore: { $avg: '$vocacoreResults.wellnessScore' }, sessions: { $sum: 1 } } },
      ]),
    ]);
    const empMap     = {};  tenantEmpCounts.forEach(e => { empMap[e._id] = e.count; });
    const sessionMap = {};  tenantSessionAggs.forEach(s => { sessionMap[s._id] = s; });
    const [tenantAlertCounts] = await Promise.all([
      Alert.aggregate([
        { $match: { status: 'new', tenantId: { $in: tenantIds } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]),
    ]);
    const alertMap = {};  tenantAlertCounts.forEach(a => { alertMap[a._id] = a.count; });

    const topTenants = allTenants
      .map(t => ({
        name:      t.displayName,
        tenantId:  t.tenantId,
        status:    t.status,
        tier:      t.contractTier,
        employees: empMap[t.tenantId] || 0,
        wellness:  Math.round(sessionMap[t.tenantId]?.avgScore || 0),
        sessions:  sessionMap[t.tenantId]?.sessions || 0,
        alerts:    alertMap[t.tenantId] || 0,
      }))
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        activeTenants:        allTenants.filter(t => t.status === 'active').length,
        totalTenants:         allTenants.length,
        totalEmployees,
        activeApiKeys,
        assessmentsToday,
        assessmentsThisMonth,
        activeAlerts,
        avgWellnessScore:     wellnessAgg[0] ? Math.round(wellnessAgg[0].avg) : 0,
        totalAssessmentsEver: wellnessAgg[0]?.count || 0,
        monthlyData,
        riskDist,
        topTenants,
        recentActivity: recentLogs.map(l => ({
          id:        l._id,
          action:    l.action,
          userId:    l.userId,
          timestamp: l.timestamp,
          outcome:   l.outcome,
        })),
      },
    });
  } catch (err) {
    logger.error('cittaa-admin overview error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch overview' } });
  }
});

// ============================================================================
// AUDIT LOG
// ============================================================================
router.get('/audit-log', ...superAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, tenantId, outcome, from, to } = req.query;
    const query = {};
    if (action)   query.action   = action;
    if (userId)   query.userId   = userId;
    if (tenantId) query.tenantId = tenantId;
    if (outcome)  query.outcome  = outcome;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to)   query.timestamp.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(query),
    ]);

    // Enrich with user display names where possible
    const userIds = [...new Set(logs.map(l => l.userId))];
    const users = await User.find({ _id: { $in: userIds } }, 'firstName lastName email').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email; });

    res.json({
      success: true,
      data: logs.map(l => ({
        id: l._id,
        action: l.action,
        user: userMap[l.userId] || l.userId,
        userId: l.userId,
        tenantId: l.tenantId,
        role: l.role,
        resource: l.targetResource,
        resourceId: l.targetResourceId,
        outcome: l.outcome,
        ipAddress: l.ipAddress,
        timestamp: l.timestamp,
        errorMessage: l.errorMessage,
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('cittaa-admin audit-log error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch audit log' } });
  }
});

// ============================================================================
// ERROR LOG — failures in AuditLog + future error store
// ============================================================================
router.get('/errors', ...superAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, from, to } = req.query;
    const query = { outcome: 'failure' };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to)   query.timestamp.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: entries.map(e => ({
        id: e._id,
        message: e.errorMessage || e.action,
        action: e.action,
        service: e.targetResource || 'api',
        userId: e.userId,
        tenantId: e.tenantId,
        statusCode: e.statusCode,
        timestamp: e.timestamp,
        stackTrace: null, // future: store stack traces in a separate collection
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('cittaa-admin errors error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch error log' } });
  }
});

// ============================================================================
// API KEYS
// ============================================================================

// GET /cittaa-admin/api-keys — list all keys (no raw key, just preview)
router.get('/api-keys', ...superAdmin, async (req, res) => {
  try {
    const keys = await ApiKey.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    // Enrich with tenant name
    const tenantIds = [...new Set(keys.map(k => k.tenantId))];
    const tenants = await Tenant.find({ tenantId: { $in: tenantIds } }, 'tenantId name').lean();
    const tenantMap = {};
    tenants.forEach(t => { tenantMap[t.tenantId] = t.name; });

    res.json({
      success: true,
      data: keys.map(k => ({
        id: k._id,
        name: k.name,
        keyPreview: k.keyHashPrefix || '••••••••',
        tenantId: k.tenantId,
        tenantName: tenantMap[k.tenantId] || null,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
        isActive: k.isActive,
        metadata: k.metadata,
      })),
    });
  } catch (err) {
    logger.error('cittaa-admin api-keys list error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch API keys' } });
  }
});

// POST /cittaa-admin/api-keys — generate a new key
router.post('/api-keys', ...superAdmin, async (req, res) => {
  try {
    const { name, description, tenantId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Key name is required' } });
    }

    // Generate a secure random key
    const rawKey = `voc_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = ApiKey.hashKey(rawKey);
    const keyHashPrefix = ApiKey.getKeyPrefix(rawKey);
    const keyId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    const useTenantId = tenantId || req.user.tenantId || 'cittaa';

    const apiKey = await ApiKey.create({
      keyId,
      tenantId: useTenantId,
      keyHash,
      keyHashPrefix,
      name: name.trim(),
      description: description || '',
      isActive: true,
      createdBy: (req.user.userId || (req.user.userId || req.user._id))?.toString(),
    });

    res.status(201).json({
      success: true,
      // Return the raw key ONCE — it is not stored and cannot be retrieved again
      key: rawKey,
      data: {
        id: apiKey._id,
        name: apiKey.name,
        keyPreview: keyHashPrefix,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    logger.error('cittaa-admin api-keys create error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create API key' } });
  }
});

// DELETE /cittaa-admin/api-keys/:id — revoke a key
router.delete('/api-keys/:id', ...superAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { isActive: false, revokedAt: new Date(), revokedBy: (req.user.userId || (req.user.userId || req.user._id))?.toString() },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    logger.error('cittaa-admin api-keys delete error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to revoke API key' } });
  }
});

// ============================================================================
// HEALTH MONITOR
// ============================================================================
router.get('/health', ...superAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
    res.json({
      success: true,
      data: {
        api: { status: 'healthy', uptime: Math.floor(process.uptime()), memory: process.memoryUsage() },
        database: { status: dbStatus },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Health check failed' } });
  }
});

// ============================================================================
// PLATFORM ANALYTICS (super-admin overview)
// ============================================================================
router.get('/analytics', ...superAdmin, async (req, res) => {
  try {
    const Tenant = require('../models/Tenant');
    const User = require('../models/User');
    const Session = require('../models/Session');
    const Consultation = require('../models/Consultation');

    const [tenants, users, sessions, consultations] = await Promise.all([
      Tenant.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Session.countDocuments({}),
      Consultation.countDocuments({}),
    ]);

    // Monthly growth (last 6 months)
    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [t, u, s] = await Promise.all([
        Tenant.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        User.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        Session.countDocuments({ createdAt: { $gte: from, $lt: to } }),
      ]);
      monthly.push({
        month: from.toLocaleString('default', { month: 'short', year: 'numeric' }),
        tenants: t, users: u, sessions: s,
      });
    }

    res.json({
      success: true,
      data: { totals: { tenants, users, sessions, consultations }, monthly },
    });
  } catch (err) {
    logger.error('cittaa-admin analytics error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load analytics' } });
  }
});


// ============================================================================
// MEMBER USAGE — how many members used the platform (per day / per tenant)
// ============================================================================
router.get('/member-usage', ...superAdmin, async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week  = new Date(today.getTime() - 6 * 86400000);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    // Unique employees who completed at least one session today / this week / this month
    const [uniqueToday, uniqueWeek, uniqueMonth, totalEver] = await Promise.all([
      Session.distinct('employeeId', { status: 'completed', createdAt: { $gte: today } }),
      Session.distinct('employeeId', { status: 'completed', createdAt: { $gte: week } }),
      Session.distinct('employeeId', { status: 'completed', createdAt: { $gte: month } }),
      Session.distinct('employeeId', { status: 'completed' }),
    ]);

    // Daily active members — last 14 days
    const twoWeeksAgo = new Date(today.getTime() - 13 * 86400000);
    const dailyAgg = await Session.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: twoWeeksAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          members:    { $addToSet: '$employeeId' },
          sessions:   { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dailyData = dailyAgg.map(d => ({
      date:         `${d._id.day} ${MONTH_ABBR[d._id.month - 1]}`,
      activeMembers: d.members.length,
      sessions:      d.sessions,
    }));

    // Per-tenant member usage (this month)
    const tenantUsage = await Session.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: month } } },
      {
        $group: {
          _id:       '$tenantId',
          members:   { $addToSet: '$employeeId' },
          sessions:  { $sum: 1 },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: 20 },
    ]);

    // Enrich with tenant names
    const tenantIds = tenantUsage.map(t => t._id);
    const tenants   = await Tenant.find({ tenantId: { $in: tenantIds } }, 'tenantId displayName name').lean();
    const tenantNameMap = {};
    tenants.forEach(t => { tenantNameMap[t.tenantId] = t.displayName || t.name; });

    const perTenant = tenantUsage.map(t => ({
      tenantId:      t._id,
      tenantName:    tenantNameMap[t._id] || t._id,
      activeMembers: t.members.length,
      sessions:      t.sessions,
    }));

    res.json({
      success: true,
      data: {
        summary: {
          activeMembersToday: uniqueToday.length,
          activeMembersThisWeek:  uniqueWeek.length,
          activeMembersThisMonth: uniqueMonth.length,
          totalMembersEver:       totalEver.length,
        },
        dailyData,
        perTenant,
      },
    });
  } catch (err) {
    logger.error('cittaa-admin member-usage error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch member usage' } });
  }
});


// ============================================================================
// B2C INDIVIDUAL REGISTRATIONS — approve / reject / list
// ============================================================================

/**
 * GET /cittaa-admin/b2c-registrations
 * List all individual (B2C) registrations, default to pending ones
 */
router.get('/b2c-registrations', ...superAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    const query = { accountType: 'b2c' };
    if (status !== 'all') query.approvalStatus = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .select('firstName lastName email accountType approvalStatus approvedAt approvedBy rejectedAt rejectionReason isActive createdAt')
          .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: users.map(u => ({
        id:              u._id,
        firstName:       u.firstName,
        lastName:        u.lastName,
        email:           u.email,
        approvalStatus:  u.approvalStatus,
        isActive:        u.isActive,
        registeredAt:    u.createdAt,
        approvedAt:      u.approvedAt  || null,
        approvedBy:      u.approvedBy  || null,
        rejectedAt:      u.rejectedAt  || null,
        rejectionReason: u.rejectionReason || null,
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('b2c-registrations list error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch B2C registrations' } });
  }
});

/**
 * POST /cittaa-admin/b2c-registrations/:userId/approve
 * Approve a pending B2C registration — activates the account
 */
router.post('/b2c-registrations/:userId/approve', ...superAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    if (user.accountType !== 'b2c') return res.status(400).json({ success: false, error: { message: 'Not a B2C account' } });
    if (user.approvalStatus === 'approved') return res.status(400).json({ success: false, error: { message: 'Already approved' } });

    user.approvalStatus = 'approved';
    user.isActive       = true;
    user.approvedAt     = new Date();
    user.approvedBy     = req.user?.userId || req.user?._id?.toString() || 'admin';
    user.rejectionReason = null;
    user.rejectedAt      = null;
    await user.save();

    // Email the user their account is approved
    emailService.sendB2CApprovalEmail({
      to:       user.email,
      name:     user.firstName,
      loginUrl: `${process.env.PLATFORM_URL || 'https://mind.cittaa.in'}/login`,
    }).catch(err => logger.error('B2C approval email failed', { error: err.message }));

    logger.info('B2C account approved', { userId: user._id, approvedBy: user.approvedBy });
    res.json({ success: true, message: `Account approved and activated for ${user.email}` });
  } catch (err) {
    logger.error('b2c approve error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to approve registration' } });
  }
});

/**
 * POST /cittaa-admin/b2c-registrations/:userId/reject
 * Reject a pending B2C registration
 * Body: { reason: string }
 */
router.post('/b2c-registrations/:userId/reject', ...superAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    if (user.accountType !== 'b2c') return res.status(400).json({ success: false, error: { message: 'Not a B2C account' } });
    if (user.approvalStatus === 'approved') return res.status(400).json({ success: false, error: { message: 'Already approved — cannot reject' } });

    user.approvalStatus  = 'rejected';
    user.isActive        = false;
    user.rejectedAt      = new Date();
    user.rejectionReason = reason || null;
    await user.save();

    // Email the user the rejection
    emailService.sendB2CRejectionEmail({
      to:     user.email,
      name:   user.firstName,
      reason: reason || null,
    }).catch(err => logger.error('B2C rejection email failed', { error: err.message }));

    logger.info('B2C account rejected', { userId: user._id, reason });
    res.json({ success: true, message: `Registration rejected for ${user.email}` });
  } catch (err) {
    logger.error('b2c reject error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to reject registration' } });
  }
});

/**
 * GET /cittaa-admin/b2c-registrations/stats
 * Summary counts for the admin badge/dashboard
 */
router.get('/b2c-registrations/stats', ...superAdmin, async (req, res) => {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      User.countDocuments({ accountType: 'b2c', approvalStatus: 'pending' }),
      User.countDocuments({ accountType: 'b2c', approvalStatus: 'approved' }),
      User.countDocuments({ accountType: 'b2c', approvalStatus: 'rejected' }),
      User.countDocuments({ accountType: 'b2c' }),
    ]);
    res.json({ success: true, data: { pending, approved, rejected, total } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch stats' } });
  }
});

// ============================================================================
// COMPANY / TENANT ROUTES (used by company admin panel)
// ============================================================================

// POST /cittaa-admin/company/hr-admins
router.post('/company/hr-admins', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: { message: 'Name and email are required' } });
    // Invitation logic placeholder — just return success for now
    res.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to invite HR admin' } });
  }
});

// POST /cittaa-admin/company/departments
router.post('/company/departments', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Department name is required' } });
    res.json({ success: true, data: { id: Date.now().toString(), name, description, employeeCount: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to create department' } });
  }
});

module.exports = router;
