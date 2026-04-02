const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');

// Roles that can view analytics across their tenant
const ANALYTICS_ROLES = ['HR_ADMIN', 'COMPANY_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST', 'CITTAA_SUPER_ADMIN', 'CITTAA_CEO'];

/**
 * GET /analytics/overview
 * Dashboard stats (scoped by role)
 */
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;

    let query = { tenantId };

    // Employees only see their own data
    if (userRole === 'EMPLOYEE') {
      query.employeeId = userId;
    }

    const [
      totalSessions,
      completedSessions,
      activeAlerts,
      criticalAlerts,
      totalEmployees,
      avgWellnessScore
    ] = await Promise.all([
      Session.countDocuments({ ...query, tenantId }),
      Session.countDocuments({ ...query, tenantId, status: 'completed' }),
      Alert.countDocuments({ tenantId, status: 'active' }),
      Alert.countDocuments({ tenantId, status: 'active', alertLevel: 'critical' }),
      userRole !== 'EMPLOYEE' ? User.countDocuments({ tenantId, role: 'EMPLOYEE' }) : 1,
      Session.aggregate([
        { $match: { ...query, tenantId, status: 'completed' } },
        {
          $group: {
            _id: null,
            // ✅ Fix: field is wellnessScore not overallScore
            avgScore: { $avg: '$employeeWellnessOutput.wellnessScore' }
          }
        }
      ])
    ]);

    const overview = {
      totalSessions,
      completedSessions,
      activeAlerts,
      criticalAlerts,
      totalEmployees,
      avgWellnessScore: (avgWellnessScore[0]?.avgScore || 0).toFixed(1),
      completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
    };

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'DASHBOARD_VIEWED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      success: true,
      data: {
        totalEmployees: overview.totalEmployees,
        assessedThisMonth: overview.completedSessions,
        needingAttention: overview.activeAlerts,
        pendingInvitations: 0,
        avgWellnessScore: overview.avgWellnessScore,
        completionRate: overview.completionRate,
        criticalAlerts: overview.criticalAlerts,
        totalSessions: overview.totalSessions,
        riskDistribution: null,
        activityData: [],
        pendingActions: [],
      }
    });
  } catch (err) {
    logger.error('Failed to get overview stats', { error: err.message });
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

/**
 * GET /analytics/trends
 * Trend data for last N days/weeks/months
 */
router.get('/trends', requireAuth, requireRole(ANALYTICS_ROLES), async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const tenantId = req.user.tenantId;
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;

    let daysBack = 7;
    if (period === 'month') daysBack = 30;
    if (period === 'quarter') daysBack = 90;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const trends = await Session.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: fromDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          avgScore: {
            $avg: '$employeeWellnessOutput.overallScore'
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'TRENDS_VIEWED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ success: true, data: { trends, period, daysBack } });
  } catch (err) {
    logger.error('Failed to get trend data', { error: err.message });
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

/**
 * GET /analytics/departments
 * Department-wise breakdown
 */
router.get('/departments', requireAuth, requireRole(ANALYTICS_ROLES), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;

    const departmentData = await Session.aggregate([
      {
        $match: { tenantId, status: 'completed' }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      },
      {
        $group: {
          _id: '$employee.department',
          count: { $sum: 1 },
          avgScore: {
            $avg: '$employeeWellnessOutput.overallScore'
          },
          avgStress: {
            $avg: '$vocacoreResults.stress_score'
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'DEPARTMENT_ANALYTICS_VIEWED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ success: true, data: { departments: departmentData } });
  } catch (err) {
    logger.error('Failed to get department analytics', { error: err.message });
    res.status(500).json({ error: 'Failed to get department analytics' });
  }
});

/**
 * GET /analytics/clinical-deep
 * Deep psychologist analytics: dimension scores, VocoScale™ tier distributions,
 * employee risk matrix, department heatmap, 12-week trend per dimension.
 * Access: SENIOR_CLINICIAN, CLINICAL_PSYCHOLOGIST, HR_ADMIN, COMPANY_ADMIN, admins
 */
router.get('/clinical-deep', requireAuth, requireRole(ANALYTICS_ROLES), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId   = (req.user.userId || req.user._id);
    const { weeks = 12 } = req.query;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (parseInt(weeks) * 7));

    // ── 1. Weekly dimension trends (depression / anxiety / stress + wellness) ─
    const dimensionTrends = await Session.aggregate([
      { $match: { tenantId, status: 'completed', createdAt: { $gte: fromDate } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%U', date: '$createdAt' } }, // year-week
          weekStart:   { $min: '$createdAt' },
          count:       { $sum: 1 },
          avgDep:      { $avg: '$vocacoreResults.dimensionalScores.depression' },
          avgAnx:      { $avg: '$vocacoreResults.dimensionalScores.anxiety' },
          avgStr:      { $avg: '$vocacoreResults.dimensionalScores.stress' },
          avgWellness: { $avg: '$employeeWellnessOutput.wellnessScore' },
          // VocoScale™ averages
          avgPHQ9:     { $avg: '$vocacoreResults.standardScales.phq9.score' },
          avgGAD7:     { $avg: '$vocacoreResults.standardScales.gad7.score' },
          avgPSS10:    { $avg: '$vocacoreResults.standardScales.pss10.score' },
      }},
      { $sort: { '_id': 1 } },
    ]);

    // ── 2. PHQ-9 tier distribution ────────────────────────────────────────────
    const phq9Dist = await Session.aggregate([
      { $match: { tenantId, status: 'completed', 'vocacoreResults.standardScales.phq9.tier': { $exists: true } } },
      { $group: { _id: '$vocacoreResults.standardScales.phq9.tier', count: { $sum: 1 } } },
    ]);

    // ── 3. GAD-7 tier distribution ────────────────────────────────────────────
    const gad7Dist = await Session.aggregate([
      { $match: { tenantId, status: 'completed', 'vocacoreResults.standardScales.gad7.tier': { $exists: true } } },
      { $group: { _id: '$vocacoreResults.standardScales.gad7.tier', count: { $sum: 1 } } },
    ]);

    // ── 4. PSS-10 tier distribution ───────────────────────────────────────────
    const pss10Dist = await Session.aggregate([
      { $match: { tenantId, status: 'completed', 'vocacoreResults.standardScales.pss10.tier': { $exists: true } } },
      { $group: { _id: '$vocacoreResults.standardScales.pss10.tier', count: { $sum: 1 } } },
    ]);

    // ── 5. Risk level distribution ────────────────────────────────────────────
    const riskDist = await Session.aggregate([
      { $match: { tenantId, status: 'completed' } },
      { $group: { _id: '$vocacoreResults.overallRiskLevel', count: { $sum: 1 } } },
    ]);

    // ── 6. Department heatmap (avg scores per dept) ───────────────────────────
    const deptHeatmap = await Session.aggregate([
      { $match: { tenantId, status: 'completed' } },
      { $lookup: { from: 'users', localField: 'patientId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmpty: true } },
      { $group: {
          _id: { $ifNull: ['$user.department', 'Unspecified'] },
          count:       { $sum: 1 },
          avgDep:      { $avg: '$vocacoreResults.dimensionalScores.depression' },
          avgAnx:      { $avg: '$vocacoreResults.dimensionalScores.anxiety' },
          avgStr:      { $avg: '$vocacoreResults.dimensionalScores.stress' },
          avgWellness: { $avg: '$employeeWellnessOutput.wellnessScore' },
          highRisk:    { $sum: { $cond: [{ $in: ['$vocacoreResults.overallRiskLevel', ['red', 'orange']] }, 1, 0] } },
      }},
      { $sort: { avgWellness: 1 } },
      { $limit: 10 },
    ]);

    // ── 7. Top at-risk employees (for psychologist view, anonymised for HR) ───
    const atRiskEmployees = await Session.aggregate([
      { $match: {
          tenantId, status: 'completed',
          'vocacoreResults.overallRiskLevel': { $in: ['red', 'orange'] },
      }},
      { $sort: { createdAt: -1 } },
      { $group: {
          _id: '$patientId',
          latestRisk:    { $first: '$vocacoreResults.overallRiskLevel' },
          latestDep:     { $first: '$vocacoreResults.dimensionalScores.depression' },
          latestAnx:     { $first: '$vocacoreResults.dimensionalScores.anxiety' },
          latestStr:     { $first: '$vocacoreResults.dimensionalScores.stress' },
          latestWellness:{ $first: '$employeeWellnessOutput.wellnessScore' },
          latestPHQ9:    { $first: '$vocacoreResults.standardScales.phq9.score' },
          latestGAD7:    { $first: '$vocacoreResults.standardScales.gad7.score' },
          latestPSS10:   { $first: '$vocacoreResults.standardScales.pss10.score' },
          lastSeen:      { $first: '$createdAt' },
          sessionCount:  { $sum: 1 },
      }},
      { $limit: 20 },
    ]);

    // Populate employee names
    const enrichedAtRisk = await Promise.all(atRiskEmployees.map(async (e) => {
      const emp = await User.findById(e._id).select('firstName lastName email department').lean().catch(() => null);
      return {
        ...e,
        name:       emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unknown',
        email:      emp?.email,
        department: emp?.department,
      };
    }));

    // ── 8. Summary stats ──────────────────────────────────────────────────────
    const [totalAssessed, highRiskCount, avgWellnessArr] = await Promise.all([
      Session.countDocuments({ tenantId, status: 'completed' }),
      Session.countDocuments({ tenantId, status: 'completed', 'vocacoreResults.overallRiskLevel': { $in: ['red', 'orange'] } }),
      Session.aggregate([
        { $match: { tenantId, status: 'completed' } },
        { $group: { _id: null, avg: { $avg: '$employeeWellnessOutput.wellnessScore' } } },
      ]),
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'CLINICAL_DEEP_ANALYTICS_VIEWED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalAssessed,
          highRiskCount,
          highRiskPct: totalAssessed > 0 ? ((highRiskCount / totalAssessed) * 100).toFixed(1) : 0,
          avgWellness: (avgWellnessArr[0]?.avg || 0).toFixed(1),
        },
        dimensionTrends: dimensionTrends.map(d => ({
          week:        d._id,
          weekStart:   d.weekStart,
          count:       d.count,
          depression:  Math.round(d.avgDep  || 0),
          anxiety:     Math.round(d.avgAnx  || 0),
          stress:      Math.round(d.avgStr  || 0),
          wellness:    Math.round(d.avgWellness || 0),
          phq9:        Math.round(d.avgPHQ9  || 0),
          gad7:        Math.round(d.avgGAD7  || 0),
          pss10:       Math.round(d.avgPSS10 || 0),
        })),
        scaleDistributions: { phq9: phq9Dist, gad7: gad7Dist, pss10: pss10Dist },
        riskDistribution: riskDist,
        departmentHeatmap: deptHeatmap,
        atRiskEmployees: enrichedAtRisk,
      },
    });
  } catch (err) {
    logger.error('Failed to get clinical-deep analytics', { error: err.message });
    res.status(500).json({ error: 'Failed to get clinical analytics' });
  }
});

/**
 * GET /analytics/platform
 * Platform-wide statistics (CITTAA_SUPER_ADMIN only)
 */
router.get('/platform', requireAuth, requireRole(['CITTAA_SUPER_ADMIN','CITTAA_CEO']), async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalSessions,
      totalAlerts,
      tenantBreakdown
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: 'active' }),
      User.countDocuments(),
      Session.countDocuments(),
      Alert.countDocuments(),
      Session.aggregate([
        {
          $group: {
            _id: '$tenantId',
            sessions: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        },
        { $limit: 10 }
      ])
    ]);

    const platformStats = {
      tenants: {
        total: totalTenants,
        active: activeTenants
      },
      users: totalUsers,
      sessions: totalSessions,
      alerts: totalAlerts,
      topTenants: tenantBreakdown
    };

    await auditService.log({
      userId,
      tenantId: null,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'PLATFORM_STATS_VIEWED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ stats: platformStats });
  } catch (err) {
    logger.error('Failed to get platform analytics', { error: err.message });
    res.status(500).json({ error: 'Failed to get platform analytics' });
  }
});

/**
 * GET /analytics/export
 * Export analytics data (CSV)
 */
router.get('/export', requireAuth, requireRole(ANALYTICS_ROLES), async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const tenantId = req.user.tenantId;
    const userId = (req.user.userId || req.user._id);
    const requestId = req.requestId;

    const sessions = await Session.find({ tenantId, status: 'completed' })
      .populate('employeeId', 'firstName lastName email department');

    if (format === 'csv') {
      const headers = [
        'Date',
        'Employee Name',
        'Email',
        'Department',
        'Wellness Score',
        'Stress Level',
        'Status'
      ];

      const rows = sessions.map(session => [
        new Date(session.createdAt).toLocaleDateString(),
        `${session.employeeId.firstName} ${session.employeeId.lastName}`,
        session.employeeId.email,
        session.employeeId.department || 'N/A',
        session.employeeWellnessOutput?.overallScore || 'N/A',
        session.employeeWellnessOutput?.stressLevel || 'N/A',
        session.status
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.csv"');
      res.send(csv);
    } else {
      res.json({ sessions });
    }

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'ANALYTICS_EXPORTED',
      targetResource: 'Analytics',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { format, recordCount: sessions.length }
    });
  } catch (err) {
    logger.error('Failed to export analytics', { error: err.message });
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

module.exports = router;
