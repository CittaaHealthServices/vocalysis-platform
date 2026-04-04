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

const MANAGER_ROLES = ['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICAL_LEAD', 'CITTAA_SUPER_ADMIN', 'CITTAA_CEO'];

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

// ── GET /coaching/nudges ──────────────────────────────────────────────────────
// AI-driven proactive coaching nudges for managers.
// Analyses 14-day team trends and generates specific, actionable nudge cards
// without exposing individual employee data.
//
// A nudge is triggered when:
//   • Team average stress/dep/anxiety rose ≥ 10 points vs prior 14-day window
//   • ≥ 2 employees have orange/red risk (quorum threshold for action)
//   • Burnout score ≥ 50 for the team average
//   • Active unresolved alerts exceed a threshold
//
// Returns: [{ id, type, title, insight, action, urgency, dimension, metric }]

router.get('/nudges', requireAuth, requireRole(MANAGER_ROLES), async (req, res) => {
  try {
    const tenantId  = req.user.tenantId;
    const now       = new Date();
    const T14       = new Date(now - 14 * 86400000);
    const T28       = new Date(now - 28 * 86400000);

    // Fetch two 14-day windows to compute trend direction
    const [recentSessions, priorSessions, openAlerts] = await Promise.all([
      Session.find({ tenantId, status: 'completed', sessionDate: { $gte: T14 } })
        .select('vocacoreResults.dimensionalScores vocacoreResults.overallRiskLevel employeeWellnessOutput.wellnessScore patientId trendData')
        .lean(),
      Session.find({ tenantId, status: 'completed', sessionDate: { $gte: T28, $lt: T14 } })
        .select('vocacoreResults.dimensionalScores employeeWellnessOutput.wellnessScore')
        .lean(),
      Alert.countDocuments({ tenantId, status: { $in: ['new', 'acknowledged'] }, severity: { $in: ['high', 'critical'] } }),
    ]);

    if (recentSessions.length === 0) {
      return res.json({ success: true, nudges: [], message: 'Not enough data yet — nudges appear after your team completes check-ins.' });
    }

    // ── Compute averages ────────────────────────────────────────────────────────
    const _avg = (arr, fn) => arr.length ? arr.reduce((s, x) => s + (fn(x) || 0), 0) / arr.length : 0;

    const dims = ['depression', 'anxiety', 'stress', 'burnout'];
    const recent  = {};
    const prior   = {};
    const delta   = {};
    for (const d of dims) {
      recent[d] = _avg(recentSessions, s => s.vocacoreResults?.dimensionalScores?.[d]);
      prior[d]  = priorSessions.length
        ? _avg(priorSessions, s => s.vocacoreResults?.dimensionalScores?.[d])
        : recent[d];  // no baseline → no delta nudge
      delta[d]  = recent[d] - prior[d];
    }
    const recentWellness = _avg(recentSessions, s => s.employeeWellnessOutput?.wellnessScore);
    const priorWellness  = priorSessions.length
      ? _avg(priorSessions,  s => s.employeeWellnessOutput?.wellnessScore)
      : recentWellness;
    const wellnessDelta  = recentWellness - priorWellness;

    const atRisk = recentSessions.filter(s => ['orange','red'].includes(s.vocacoreResults?.overallRiskLevel)).length;
    const atRiskPct = Math.round(atRisk / recentSessions.length * 100);

    // Count employees with a pre-alert trend flag
    const preAlertCount = recentSessions.filter(s => s.trendData?.preAlert).length;

    // ── Build nudge cards ───────────────────────────────────────────────────────
    const nudges = [];
    let nudgeId  = 1;

    // Rising stress nudge
    if (delta.stress >= 8 && recent.stress >= 45) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'rising_stress',
        urgency:   delta.stress >= 15 ? 'high' : 'medium',
        dimension: 'stress',
        title:     delta.stress >= 15 ? '⚠️ Team Stress Spiking' : '📈 Team Stress Rising',
        insight:   `Average team stress has risen by ${Math.round(delta.stress)} points over the last 14 days (now ${Math.round(recent.stress)}/100). This pattern often precedes burnout or disengagement.`,
        action:    'Hold a brief 1:1 with each team member this week. Ask: "Is there anything I can take off your plate?" — even small relief signals genuine support.',
        metric:    { current: Math.round(recent.stress), prior: Math.round(prior.stress), delta: Math.round(delta.stress) },
        playbook:  { dimension: 'stress', riskLevel: delta.stress >= 15 ? 'red' : 'orange' },
      });
    }

    // Rising depression nudge
    if (delta.depression >= 8 && recent.depression >= 40) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'rising_depression',
        urgency:   delta.depression >= 15 ? 'high' : 'medium',
        dimension: 'depression',
        title:     '🌧️ Low Mood Patterns Detected',
        insight:   `Low mood / energy markers have increased by ${Math.round(delta.depression)} points in the last 14 days. This can affect motivation, productivity, and team morale if left unaddressed.`,
        action:    'Reduce non-essential meetings for the team this week. Consider a "low-input day" where people can work without interruptions. Small flexibility signals can have outsized impact.',
        metric:    { current: Math.round(recent.depression), prior: Math.round(prior.depression), delta: Math.round(delta.depression) },
        playbook:  { dimension: 'depression', riskLevel: 'orange' },
      });
    }

    // Rising anxiety nudge
    if (delta.anxiety >= 8 && recent.anxiety >= 45) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'rising_anxiety',
        urgency:   'medium',
        dimension: 'anxiety',
        title:     '😰 Anxiety Patterns Rising',
        insight:   `Anxiety markers have risen by ${Math.round(delta.anxiety)} points. This often accompanies unclear expectations, upcoming deadlines, or organisational uncertainty.`,
        action:    'Clarify priorities and deadlines in writing for the next 2 weeks. Uncertainty is a key driver of workplace anxiety — concrete plans reduce it.',
        metric:    { current: Math.round(recent.anxiety), prior: Math.round(prior.anxiety), delta: Math.round(delta.anxiety) },
        playbook:  { dimension: 'anxiety', riskLevel: 'orange' },
      });
    }

    // Burnout risk nudge
    if (recent.burnout >= 55) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'burnout_risk',
        urgency:   recent.burnout >= 70 ? 'high' : 'medium',
        dimension: 'burnout',
        title:     recent.burnout >= 70 ? '🔥 High Burnout Risk' : '🕯️ Burnout Risk Building',
        insight:   `Team burnout score is ${Math.round(recent.burnout)}/100. Burnout develops gradually — the window to intervene with low-cost changes is still open.`,
        action:    'Rotate high-pressure tasks. Identify 1-2 team members carrying disproportionate load and redistribute proactively — do not wait for them to ask.',
        metric:    { current: Math.round(recent.burnout), prior: Math.round(prior.burnout), delta: Math.round(delta.burnout) },
        playbook:  { dimension: 'burnout', riskLevel: recent.burnout >= 70 ? 'red' : 'orange' },
      });
    }

    // At-risk team percentage nudge
    if (atRiskPct >= 30 || (atRisk >= 2 && atRiskPct >= 20)) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'at_risk_cluster',
        urgency:   atRiskPct >= 50 ? 'high' : 'medium',
        dimension: 'overall',
        title:     `👥 ${atRiskPct}% of Team in At-Risk Zone`,
        insight:   `${atRisk} out of ${recentSessions.length} recent check-ins show elevated risk. When ≥30% of a team is struggling, systemic factors (workload, culture, leadership) are often at play.`,
        action:    'Consider an anonymous team pulse survey or a team retrospective focused on what\'s making work harder than it needs to be.',
        metric:    { atRiskCount: atRisk, totalSessions: recentSessions.length, atRiskPct },
        playbook:  { dimension: 'stress', riskLevel: 'orange' },
      });
    }

    // Pre-alert trend nudge
    if (preAlertCount >= 1) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'pre_alert_trend',
        urgency:   preAlertCount >= 2 ? 'high' : 'medium',
        dimension: 'trend',
        title:     `📉 Early Deterioration Detected`,
        insight:   `${preAlertCount} team member${preAlertCount > 1 ? 's are' : ' is'} showing a consistent worsening trend over recent check-ins, even without crossing critical thresholds yet. Early intervention is most effective at this stage.`,
        action:    'Schedule a casual one-on-one check-in — not a performance review. Focus on how they\'re feeling about their work, not outputs.',
        metric:    { preAlertCount },
        playbook:  { dimension: 'stress', riskLevel: 'orange' },
      });
    }

    // Open alerts nudge
    if (openAlerts >= 3) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'unresolved_alerts',
        urgency:   openAlerts >= 5 ? 'high' : 'medium',
        dimension: 'alerts',
        title:     `🔔 ${openAlerts} Unresolved Wellbeing Alerts`,
        insight:   `${openAlerts} high-severity alerts are awaiting action. Delayed response to wellbeing alerts reduces employee trust in the programme.`,
        action:    'Review and resolve alerts in the Action Items tab. Even a brief acknowledgement — "I\'ve seen this and I\'m checking in" — matters.',
        metric:    { openAlerts },
        playbook:  { dimension: 'stress', riskLevel: 'red' },
      });
    }

    // Positive nudge — good trend worth reinforcing
    if (wellnessDelta >= 5 && recentWellness >= 65 && nudges.length === 0) {
      nudges.push({
        id:        `nudge_${nudgeId++}`,
        type:      'positive_trend',
        urgency:   'low',
        dimension: 'wellness',
        title:     '✅ Team Wellness Improving',
        insight:   `Team wellness score has risen by ${Math.round(wellnessDelta)} points over the last 14 days (now ${Math.round(recentWellness)}/100). Positive momentum is worth acknowledging.`,
        action:    'Recognise the team\'s effort — publicly or personally. Share that you\'ve noticed the positive energy and appreciate it.',
        metric:    { current: Math.round(recentWellness), prior: Math.round(priorWellness), delta: Math.round(wellnessDelta) },
        playbook:  null,
      });
    }

    // Sort by urgency: high → medium → low
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    nudges.sort((a, b) => (urgencyOrder[a.urgency] || 1) - (urgencyOrder[b.urgency] || 1));

    res.json({
      success:     true,
      nudges,
      generatedAt: new Date().toISOString(),
      meta: {
        teamAvg:     { ...Object.fromEntries(dims.map(d => [d, Math.round(recent[d])])), wellness: Math.round(recentWellness) },
        trends:      Object.fromEntries(dims.map(d => [d, Math.round(delta[d])])),
        atRiskPct,
        openAlerts,
        sessionCount: recentSessions.length,
      },
    });
  } catch (err) {
    logger.error('GET /coaching/nudges failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
