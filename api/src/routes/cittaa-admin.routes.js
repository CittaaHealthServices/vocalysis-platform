/**
 * Cittaa Admin routes — super-admin and CEO oversight.
 * Mounted at /cittaa-admin
 */
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Tenant  = require('../models/Tenant');
const Session = require('../models/Session');
const Alert   = require('../models/Alert');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger  = require('../utils/logger');

const ADMIN_ROLES = ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO'];

// ── Platform overview (CEO dashboard) ────────────────────────────────────────
router.get('/overview', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Core counts (parallel)
    const [
      totalTenants,
      activeTenants,
      totalEmployees,
      assessmentsToday,
      assessmentsThisMonth,
      totalAssessmentsEver,
      activeAlerts,
    ] = await Promise.all([
      Tenant.countDocuments({}),
      Tenant.countDocuments({ status: { $in: ['active', 'trial'] } }),
      User.countDocuments({ role: { $nin: ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'API_CLIENT'] }, isActive: true }),
      Session.countDocuments({ createdAt: { $gte: todayStart }, status: 'completed' }),
      Session.countDocuments({ createdAt: { $gte: monthStart }, status: 'completed' }),
      Session.countDocuments({ status: 'completed' }),
      Alert.countDocuments({ status: { $in: ['open', 'pending'] } }).catch(() => 0),
    ]);

    // Average wellness score across all completed sessions
    const wellnessAgg = await Session.aggregate([
      { $match: { status: 'completed', 'employeeWellnessOutput.wellnessScore': { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$employeeWellnessOutput.wellnessScore' } } },
    ]).catch(() => []);
    const avgWellnessScore = wellnessAgg[0]?.avg ? Math.round(wellnessAgg[0].avg) : null;

    // Monthly assessment trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRaw = await Session.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          assessments: { $sum: 1 },
          avgScore: { $avg: '$employeeWellnessOutput.wellnessScore' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).catch(() => []);

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyData = monthlyRaw.map(m => ({
      month: `${MONTH_NAMES[m._id.month - 1]} ${m._id.year}`,
      assessments: m.assessments,
      avgScore: m.avgScore ? Math.round(m.avgScore) : 0,
    }));

    // Risk distribution across all completed sessions
    const riskRaw = await Session.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$employeeWellnessOutput.riskLevel', count: { $sum: 1 } } },
    ]).catch(() => []);

    const riskMap = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    riskRaw.forEach(r => { if (r._id && riskMap[r._id] !== undefined) riskMap[r._id] = r.count; });
    const riskDist = [
      { name: 'Low',      value: riskMap.LOW },
      { name: 'Moderate', value: riskMap.MODERATE },
      { name: 'High',     value: riskMap.HIGH },
      { name: 'Critical', value: riskMap.CRITICAL },
    ];

    // Top tenants
    const tenants = await Tenant.find({}).sort({ createdAt: -1 }).limit(20).lean().catch(() => []);
    const topTenants = await Promise.all(
      tenants.map(async (t) => {
        const [empCount, sessionCount, alertCount, wellnessA] = await Promise.all([
          User.countDocuments({ tenantId: t.tenantId || t._id.toString(), isActive: true }),
          Session.countDocuments({ tenantId: t.tenantId || t._id.toString(), status: 'completed' }),
          Alert.countDocuments({ tenantId: t.tenantId || t._id.toString(), status: { $in: ['open', 'pending'] } }).catch(() => 0),
          Session.aggregate([
            { $match: { tenantId: t.tenantId || t._id.toString(), status: 'completed' } },
            { $group: { _id: null, avg: { $avg: '$employeeWellnessOutput.wellnessScore' } } },
          ]).catch(() => []),
        ]);
        return {
          name: t.displayName || t.legalName || t.name || 'Unnamed',
          status: t.status || 'active',
          employees: empCount,
          sessions: sessionCount,
          alerts: alertCount,
          wellness: wellnessA[0]?.avg ? Math.round(wellnessA[0].avg) : 0,
        };
      })
    );
    topTenants.sort((a, b) => b.employees - a.employees);

    // Active API keys count
    let activeApiKeys = 0;
    try {
      const ApiKey = require('../models/ApiKey.model');
      activeApiKeys = await ApiKey.countDocuments({ isActive: true });
    } catch (_) {}

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalEmployees,
        assessmentsToday,
        assessmentsThisMonth,
        totalAssessmentsEver,
        activeAlerts,
        avgWellnessScore,
        activeApiKeys,
        monthlyData,
        riskDist,
        topTenants,
      },
    });
  } catch (err) {
    logger.error('cittaa-admin overview failed', { error: err.message });
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

// ── Tenant list ───────────────────────────────────────────────────────────────
router.get('/tenants', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { legalName:   { $regex: search, $options: 'i' } },
      ];
    }
    const [tenants, total] = await Promise.all([
      Tenant.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit).lean(),
      Tenant.countDocuments(query),
    ]);
    res.json({ success: true, data: { tenants, total, page: +page, limit: +limit } });
  } catch (err) {
    logger.error('Failed to list tenants', { error: err.message });
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

// ── Health check (platform-wide) ─────────────────────────────────────────────
router.get('/health', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  const [dbOk, usersCount] = await Promise.all([
    User.countDocuments({}).then(() => true).catch(() => false),
    User.countDocuments({ isActive: true }).catch(() => 0),
  ]);
  res.json({
    success: true,
    data: {
      database: dbOk ? 'ok' : 'error',
      activeUsers: usersCount,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
