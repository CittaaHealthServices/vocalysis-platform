/**
 * Manager Coaching Routes
 * GET  /coaching/team-heatmap      — anonymised team risk heatmap
 * GET  /coaching/playbook          — coaching playbook for a risk pattern
 * GET  /coaching/action-items      — pending action items for this manager
 * POST /coaching/action-items/:id  — mark action item resolved
 */

const express  = require('express');
const router   = express.Router();
const Session  = require('../models/Session');
const Employee = require('../models/Employee');
const Alert    = require('../models/Alert');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPlaybook, getDominantDimension } = require('../data/coachingPlaybooks');
const logger   = require('../utils/logger');

const MANAGER_ROLES = ['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICAL_LEAD', 'CITTAA_SUPER_ADMIN'];

// ── GET /coaching/team-heatmap ────────────────────────────────────────────────
// Returns anonymised team wellness overview for this manager's scope.
// HR_ADMIN sees all employees in tenant. COMPANY_ADMIN same.
// Individual names are NEVER returned — only aggregated + anonymised signals.

router.get('/team-heatmap', requireAuth, requireRole(MANAGER_ROLES), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const days     = parseInt(req.query.days) || 14;
    const since    = new Date(Date.now() - days * 86400000);

    // Pull recent completed sessions for this tenant
    const sessions = await Session.find({
      tenantId,
      status:     'completed',
      sessionDate: { $gte: since },
    })
    .select('patientId vocacoreResults.overallRiskLevel vocacoreResults.dimensionalScores employeeWellnessOutput.wellnessScore sessionDate departmentId')
    .lean();

    // Department-level aggregation (anonymised)
    const deptMap = {};
    for (const s of sessions) {
      const dept = s.departmentId || 'unassigned';
      if (!deptMap[dept]) {
        deptMap[dept] = {
          departmentId:  dept,
          sessionCount:  0,
          wellnessTotal: 0,
          riskCounts:    { green: 0, yellow: 0, orange: 0, red: 0 },
          dimTotals:     { depression: 0, anxiety: 0, stress: 0, burnout: 0 },
          uniqueEmployees: new Set(),
        };
      }
      const d   = deptMap[dept];
      const lvl = s.vocacoreResults?.overallRiskLevel || 'green';
      d.sessionCount++;
      d.wellnessTotal        += s.employeeWellnessOutput?.wellnessScore || 0;
      d.riskCounts[lvl]      = (d.riskCounts[lvl] || 0) + 1;
      d.uniqueEmployees.add(s.patientId);
      const dims = s.vocacoreResults?.dimensionalScores || {};
      d.dimTotals.depression += dims.depression || 0;
      d.dimTotals.anxiety    += dims.anxiety    || 0;
      d.dimTotals.stress     += dims.stress     || 0;
      d.dimTotals.burnout    += dims.burnout    || 0;
    }

    const departments = Object.values(deptMap).map(d => {
      const count = d.sessionCount || 1;
      const empCount = d.uniqueEmployees.size;
      return {
        departmentId:        d.departmentId,
        employeeCount:       empCount,
        sessionCount:        d.sessionCount,
        avgWellnessScore:    Math.round(d.wellnessTotal / count),
        riskDistribution:    d.riskCounts,
        atRiskCount:         (d.riskCounts.orange || 0) + (d.riskCounts.red || 0),
        avgDimensionalScores: {
          depression: Math.round(d.dimTotals.depression / count),
          anxiety:    Math.round(d.dimTotals.anxiety    / count),
          stress:     Math.round(d.dimTotals.stress     / count),
          burnout:    Math.round(d.dimTotals.burnout    / count),
        },
        dominantConcern: getDominantDimension({
          depression: d.dimTotals.depression / count,
          anxiety:    d.dimTotals.anxiety    / count,
          stress:     d.dimTotals.stress     / count,
          burnout:    d.dimTotals.burnout    / count,
        }),
      };
    });

    // Tenant-level summary
    const totalSessions   = sessions.length;
    const atRiskSessions  = sessions.filter(s => ['orange','red'].includes(s.vocacoreResults?.overallRiskLevel)).length;
    const avgWellness     = totalSessions
      ? Math.round(sessions.reduce((s, x) => s + (x.employeeWellnessOutput?.wellnessScore || 0), 0) / totalSessions)
      : 0;

    res.json({
      success: true,
      period:  { days, since },
      summary: {
        totalSessions,
        atRiskCount:      atRiskSessions,
        atRiskPct:        totalSessions ? Math.round(atRiskSessions / totalSessions * 100) : 0,
        avgWellnessScore: avgWellness,
        activeAlerts:     await Alert.countDocuments({ tenantId, status: { $in: ['new','acknowledged'] } }),
      },
      departments: departments.sort((a, b) => b.atRiskCount - a.atRiskCount),
    });
  } catch (err) {
    logger.error('GET /coaching/team-heatmap failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── GET /coaching/playbook ────────────────────────────────────────────────────
// Returns the coaching playbook for a given risk pattern.
// Query params: ?dimension=stress&riskLevel=red

router.get('/playbook', requireAuth, requireRole(MANAGER_ROLES), async (req, res) => {
  const { dimension = 'stress', riskLevel = 'orange' } = req.query;
  const playbook = getPlaybook(dimension, riskLevel);
  res.json({ success: true, playbook, dimension, riskLevel });
});

// ── GET /coaching/action-items ────────────────────────────────────────────────
// Returns pending coaching action items — built from unresolved high-risk alerts
// + recommended playbook actions. No individual names exposed unless manager
// is also an HR admin who explicitly requests them.

router.get('/action-items', requireAuth, requireRole(MANAGER_ROLES), async (req, res) => {
  try {
    const tenantId  = req.user.tenantId;
    const showNames = req.query.showNames === 'true' && ['HR_ADMIN','COMPANY_ADMIN','CITTAA_SUPER_ADMIN'].includes(req.user.role);

    const alerts = await Alert.find({
      tenantId,
      status:    { $in: ['new', 'acknowledged'] },
      severity:  { $in: ['high', 'critical'] },
    })
    .sort({ triggeredAt: -1 })
    .limit(50)
    .lean();

    const items = await Promise.all(alerts.map(async (alert) => {
      // Get latest session for this employee to determine dominant dimension
      const latestSession = await Session.findOne({
        tenantId,
        patientId: alert.employeeId,
        status:    'completed',
      })
      .sort({ sessionDate: -1 })
      .select('vocacoreResults.dimensionalScores vocacoreResults.overallRiskLevel employeeWellnessOutput.wellnessScore departmentId')
      .lean();

      const dims       = latestSession?.vocacoreResults?.dimensionalScores || {};
      const riskLevel  = latestSession?.vocacoreResults?.overallRiskLevel || alert.severity === 'critical' ? 'red' : 'orange';
      const dimension  = getDominantDimension(dims);
      const playbook   = getPlaybook(dimension, riskLevel);

      // Employee info — anonymised unless showNames
      let employeeInfo = { id: alert.employeeId, department: latestSession?.departmentId };
      if (showNames) {
        const emp = await Employee.findOne({ employeeId: alert.employeeId }).select('fullName department').lean();
        if (emp) { employeeInfo.name = emp.fullName; employeeInfo.department = emp.department; }
      }

      return {
        alertId:        alert._id,
        alertStatus:    alert.status,
        severity:       alert.severity,
        triggeredAt:    alert.triggeredAt,
        employee:       employeeInfo,
        riskLevel,
        dominantConcern: dimension,
        wellnessScore:  latestSession?.employeeWellnessOutput?.wellnessScore,
        playbookTitle:  playbook.title,
        urgency:        playbook.urgency,
        topActions:     playbook.actions.slice(0, 3),
        topConversationStarter: playbook.conversationStarters[0],
        escalateIf:     playbook.escalateIf,
      };
    }));

    res.json({ success: true, actionItems: items, total: items.length });
  } catch (err) {
    logger.error('GET /coaching/action-items failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── POST /coaching/action-items/:alertId/resolve ──────────────────────────────
// Manager marks an action item as addressed.

router.post('/action-items/:alertId/resolve', requireAuth, requireRole(MANAGER_ROLES), async (req, res) => {
  try {
    const { alertId }  = req.params;
    const { note = '' } = req.body;
    const tenantId     = req.user.tenantId;

    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, tenantId },
      {
        status:     'resolved',
        resolvedAt: new Date(),
        resolvedBy: req.user.userId || req.user._id,
        resolutionSummary: note || 'Manager coaching action completed',
      },
      { new: true }
    );

    if (!alert) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
