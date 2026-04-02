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
