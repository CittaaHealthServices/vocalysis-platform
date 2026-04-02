/**
 * Outcome Tracking Routes — Closed-Loop Measurement
 *
 * POST /outcomes/followup/:sessionId/respond  — employee submits follow-up mood
 * GET  /outcomes/roi                          — HR ROI dashboard data
 * GET  /outcomes/intervention-effectiveness   — which interventions work best
 * GET  /outcomes/employee/:employeeId         — employee outcome history
 * POST /outcomes/consultation/:sessionId      — psychologist submits outcome form
 */

const express       = require('express');
const router        = express.Router();
const Session       = require('../models/Session');
const OutcomeFollowUp = require('../models/OutcomeFollowUp');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger        = require('../utils/logger');

// ── POST /outcomes/followup/:sessionId/respond ────────────────────────────────
// Employee taps Better / Same / Harder in response to follow-up ping.

router.post('/followup/:sessionId/respond', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { response, moodScore, notes } = req.body;
    const employeeId = req.user.userId || req.user._id;

    if (!['better', 'same', 'harder'].includes(response)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_RESPONSE', message: 'Response must be better, same, or harder' } });
    }

    const followUp = await OutcomeFollowUp.findOneAndUpdate(
      { sessionId, employeeId, status: { $in: ['pending', 'sent'] } },
      {
        'selfReport.response':    response,
        'selfReport.moodScore':   moodScore || null,
        'selfReport.notes':       notes || '',
        'selfReport.respondedAt': new Date(),
        status: 'responded',
      },
      { new: true }
    );

    if (!followUp) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No pending follow-up for this session' } });
    }

    // Fetch current wellness score to compare to baseline
    const currentSession = await Session.findOne({
      patientId: employeeId,
      status:    'completed',
    })
    .sort({ sessionDate: -1 })
    .select('employeeWellnessOutput.wellnessScore vocacoreResults.overallRiskLevel')
    .lean();

    if (currentSession) {
      await OutcomeFollowUp.findByIdAndUpdate(followUp._id, {
        'followUpScore.wellnessScore': currentSession.employeeWellnessOutput?.wellnessScore,
        'followUpScore.riskLevel':     currentSession.vocacoreResults?.overallRiskLevel,
        'followUpScore.measuredAt':    new Date(),
      });
    }

    res.json({ success: true, message: 'Thank you for sharing — your feedback helps us support you better.' });
  } catch (err) {
    logger.error('POST /outcomes/followup respond failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── POST /outcomes/consultation/:sessionId ────────────────────────────────────
// Psychologist submits outcome form after consultation.

router.post('/consultation/:sessionId', requireAuth, requireRole(['CLINICAL_PSYCHOLOGIST','CLINICAL_LEAD','CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { goalsAchieved, patientEngagement, progressNotes, recommendedFollowUp, sessionType } = req.body;
    const tenantId  = req.user.tenantId;
    const clinicianId = req.user.userId || req.user._id;

    // Find or create outcome record for this session
    let outcome = await OutcomeFollowUp.findOne({ sessionId, type: 'consultation_outcome' });
    if (!outcome) {
      const session = await Session.findOne({ sessionId }).lean();
      if (!session) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      outcome = new OutcomeFollowUp({
        tenantId,
        employeeId:   session.patientId,
        sessionId,
        type:         'consultation_outcome',
        scheduledFor: new Date(),
        channel:      'in_app',
        status:       'responded',
      });
    }

    outcome.consultationOutcome = {
      sessionType,
      goalsAchieved:       parseInt(goalsAchieved),
      patientEngagement:   parseInt(patientEngagement),
      progressNotes,
      recommendedFollowUp: !!recommendedFollowUp,
      clinicianId,
      submittedAt:         new Date(),
    };
    outcome.status = 'responded';
    await outcome.save();

    res.json({ success: true, outcome });
  } catch (err) {
    logger.error('POST /outcomes/consultation failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── GET /outcomes/roi ─────────────────────────────────────────────────────────
// HR ROI dashboard: score improvement, response rates, intervention effectiveness.

router.get('/roi', requireAuth, requireRole(['HR_ADMIN','COMPANY_ADMIN','CLINICAL_LEAD','CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const days     = parseInt(req.query.days) || 90;
    const since    = new Date(Date.now() - days * 86400000);

    // ── 1. Overall score trend: compare first and last sessions per employee ──
    const allSessions = await Session.find({
      tenantId, status: 'completed', sessionDate: { $gte: since },
    })
    .select('patientId employeeWellnessOutput.wellnessScore vocacoreResults.overallRiskLevel sessionDate')
    .sort({ sessionDate: 1 })
    .lean();

    // Build per-employee first vs last score
    const empMap = {};
    for (const s of allSessions) {
      const eid   = s.patientId;
      const score = s.employeeWellnessOutput?.wellnessScore;
      if (score == null) continue;
      if (!empMap[eid]) empMap[eid] = { first: score, last: score, sessions: 0 };
      empMap[eid].last = score;
      empMap[eid].sessions++;
    }
    const employees = Object.values(empMap);
    const improved  = employees.filter(e => e.last > e.first + 3).length;
    const declined  = employees.filter(e => e.last < e.first - 3).length;
    const stable    = employees.length - improved - declined;
    const avgImprovement = employees.length
      ? Math.round(employees.reduce((s, e) => s + (e.last - e.first), 0) / employees.length * 10) / 10
      : 0;

    // ── 2. Risk level migration: how many moved green from orange/red ──────────
    const movedToGreen = employees.filter(e => {
      const firstSession = allSessions.find(s => s.patientId === Object.keys(empMap)[employees.indexOf(e)]);
      const lastSession  = [...allSessions].reverse().find(s => s.patientId === Object.keys(empMap)[employees.indexOf(e)]);
      return firstSession?.vocacoreResults?.overallRiskLevel !== 'green' &&
             lastSession?.vocacoreResults?.overallRiskLevel  === 'green';
    }).length;

    // ── 3. Follow-up response metrics ─────────────────────────────────────────
    const followUps    = await OutcomeFollowUp.find({ tenantId, type: 'checkin_followup', createdAt: { $gte: since } }).lean();
    const sent         = followUps.filter(f => ['sent','responded'].includes(f.status)).length;
    const responded    = followUps.filter(f => f.status === 'responded' && f.selfReport?.response).length;
    const betterCount  = followUps.filter(f => f.selfReport?.response === 'better').length;
    const harderCount  = followUps.filter(f => f.selfReport?.response === 'harder').length;
    const sameCount    = followUps.filter(f => f.selfReport?.response === 'same').length;

    // ── 4. 30-day rolling wellness trend ──────────────────────────────────────
    const last30Days = new Date(Date.now() - 30 * 86400000);
    const trendSessions = await Session.aggregate([
      { $match: { tenantId, status: 'completed', sessionDate: { $gte: last30Days } } },
      { $group: {
          _id:      { $dateToString: { format: '%Y-%m-%d', date: '$sessionDate' } },
          avgScore: { $avg: '$employeeWellnessOutput.wellnessScore' },
          count:    { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    // ── 5. Consultation outcomes ───────────────────────────────────────────────
    const consultOutcomes = await OutcomeFollowUp.find({
      tenantId, type: 'consultation_outcome',
      'consultationOutcome.submittedAt': { $gte: since },
    }).lean();

    const avgGoalsAchieved = consultOutcomes.length
      ? Math.round(consultOutcomes.reduce((s, o) => s + (o.consultationOutcome?.goalsAchieved || 0), 0) / consultOutcomes.length * 10) / 10
      : null;
    const avgEngagement = consultOutcomes.length
      ? Math.round(consultOutcomes.reduce((s, o) => s + (o.consultationOutcome?.patientEngagement || 0), 0) / consultOutcomes.length * 10) / 10
      : null;

    res.json({
      success: true,
      period:  { days, since },
      scoreImprovement: {
        totalEmployeesTracked: employees.length,
        improved,
        stable,
        declined,
        avgScoreChange:        avgImprovement,
        employeesMovedToGreen: movedToGreen,
        improvementRate:       employees.length ? Math.round(improved / employees.length * 100) : 0,
      },
      followUpEngagement: {
        totalSent:        sent,
        totalResponded:   responded,
        responseRate:     sent ? Math.round(responded / sent * 100) : 0,
        outcomes: { better: betterCount, same: sameCount, harder: harderCount },
        betterRate: responded ? Math.round(betterCount / responded * 100) : 0,
      },
      wellnessTrend30Days: trendSessions.map(t => ({
        date:     t._id,
        avgScore: Math.round(t.avgScore),
        sessions: t.count,
      })),
      consultationQuality: {
        totalOutcomesRecorded: consultOutcomes.length,
        avgGoalsAchieved,
        avgEngagement,
        followUpRecommended: consultOutcomes.filter(o => o.consultationOutcome?.recommendedFollowUp).length,
      },
    });
  } catch (err) {
    logger.error('GET /outcomes/roi failed', { error: err.message });
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── GET /outcomes/intervention-effectiveness ───────────────────────────────────
// Which intervention types correlate with the most score improvement.

router.get('/intervention-effectiveness', requireAuth, requireRole(['HR_ADMIN','COMPANY_ADMIN','CLINICAL_LEAD','CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const since    = new Date(Date.now() - 90 * 86400000);

    const outcomes = await OutcomeFollowUp.find({
      tenantId,
      status:      'responded',
      'selfReport.response': { $exists: true },
      createdAt:   { $gte: since },
    }).lean();

    // Group by trigger dominant dimension
    const byDimension = {};
    for (const o of outcomes) {
      const dim = o.triggerContext?.dominantDimension || 'unknown';
      if (!byDimension[dim]) byDimension[dim] = { better: 0, same: 0, harder: 0, total: 0 };
      const r = o.selfReport?.response;
      if (r) { byDimension[dim][r]++; byDimension[dim].total++; }
    }

    const effectiveness = Object.entries(byDimension).map(([dimension, counts]) => ({
      dimension,
      totalFollowUps:  counts.total,
      betterRate:      counts.total ? Math.round(counts.better / counts.total * 100) : 0,
      sameRate:        counts.total ? Math.round(counts.same   / counts.total * 100) : 0,
      harderRate:      counts.total ? Math.round(counts.harder / counts.total * 100) : 0,
    })).sort((a, b) => b.betterRate - a.betterRate);

    res.json({ success: true, effectiveness, totalOutcomes: outcomes.length });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── GET /outcomes/employee/:employeeId ────────────────────────────────────────
// Employee's own outcome history (self-service).

router.get('/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const requesterId    = req.user.userId || req.user._id;
    const role           = req.user.role;

    // Employees can only see their own
    if (role === 'EMPLOYEE' && requesterId !== employeeId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    const outcomes = await OutcomeFollowUp.find({ employeeId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      outcomes: outcomes.map(o => ({
        id:           o._id,
        type:         o.type,
        status:       o.status,
        scheduledFor: o.scheduledFor,
        selfReport:   o.selfReport,
        followUpScore: o.followUpScore,
        triggerContext: o.triggerContext,
        createdAt:    o.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
