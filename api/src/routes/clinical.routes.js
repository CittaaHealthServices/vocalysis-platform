/**
 * /clinical/* routes — Clinician/Psychologist specific endpoints
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Session = require('../models/Session');
const Consultation = require('../models/Consultation');
let Alert; try { Alert = require('../models/Alert.model'); } catch { Alert = { countDocuments: async () => 0, find: async () => [] }; }
const logger = require('../utils/logger');

const clinician = [requireAuth, requireRole(['SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'])];

// ============================================================================
// DASHBOARD STATS
// ============================================================================
router.get('/stats', ...clinician, async (req, res) => {
  try {
    const clinicianId = req.user._id.toString();
    const { tenantId } = req.user;

    const [activePatients, sessionCount, pendingAlerts, upcomingConsultations] = await Promise.all([
      // Employees who have had a session reviewed by this clinician
      Session.distinct('patientId', { reviewedBy: clinicianId }),
      Session.countDocuments({ reviewedBy: clinicianId }),
      Alert.countDocuments({ tenantId, assignedTo: clinicianId, status: 'active' }).catch(() => 0),
      Consultation.countDocuments({
        clinicianId,
        status: { $in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { $gte: new Date() },
      }),
    ]);

    res.json({
      success: true,
      data: {
        activePatients: activePatients.length,
        totalSessions: sessionCount,
        pendingAlerts,
        upcomingConsultations,
        riskBreakdown: {
          high: await Alert.countDocuments({ tenantId, severity: 'high', status: 'active' }).catch(() => 0),
          medium: await Alert.countDocuments({ tenantId, severity: 'medium', status: 'active' }).catch(() => 0),
          low: await Alert.countDocuments({ tenantId, severity: 'low', status: 'active' }).catch(() => 0),
        },
      },
    });
  } catch (err) {
    logger.error('clinical/stats error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load stats' } });
  }
});

// ============================================================================
// TODAY'S SCHEDULE
// ============================================================================
router.get('/schedule/today', ...clinician, async (req, res) => {
  try {
    const clinicianId = req.user._id.toString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const consultations = await Consultation.find({
      clinicianId,
      scheduledAt: { $gte: today, $lt: tomorrow },
      status: { $in: ['SCHEDULED', 'CONFIRMED'] },
    })
      .populate('employeeId', 'firstName lastName email profilePhotoUrl')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({
      success: true,
      data: consultations.map(c => ({
        id: c._id,
        patient: c.employeeId
          ? { name: `${c.employeeId.firstName} ${c.employeeId.lastName}`.trim(), email: c.employeeId.email }
          : { name: 'Unknown Patient' },
        scheduledAt: c.scheduledAt,
        type: c.type || 'online',
        status: c.status,
        meetLink: c.googleMeet?.meetLink || null,
        duration: c.durationMinutes || 50,
      })),
    });
  } catch (err) {
    logger.error('clinical/schedule/today error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load schedule' } });
  }
});

// ============================================================================
// CLINICAL ALERTS (for the dashboard mini-list)
// ============================================================================
router.get('/alerts', ...clinician, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 5 } = req.query;
    const alerts = await Alert.find({ tenantId, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()
      .catch(() => []);
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to load alerts' } });
  }
});

// ============================================================================
// PATIENTS (employees this clinician has access to)
// ============================================================================
router.get('/patients', ...clinician, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { search, riskLevel, page = 1, limit = 50 } = req.query;
    const query = { tenantId, role: 'EMPLOYEE', isActive: true };
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ firstName: re }, { lastName: re }, { email: re }, { employeeId: re }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [patients, total] = await Promise.all([
      User.find(query).skip(skip).limit(Number(limit))
        .select('firstName lastName email employeeId departmentId jobTitle createdAt')
        .lean(),
      User.countDocuments(query),
    ]);

    // Enrich with latest session score
    const enriched = await Promise.all(patients.map(async (p) => {
      const latest = await Session.findOne({ userId: p._id.toString() })
        .sort({ createdAt: -1 })
        .select('vocalysisScore emotionalState createdAt')
        .lean();
      return {
        ...p,
        latestScore: latest?.vocalysisScore || null,
        latestMood: latest?.emotionalState || null,
        lastSessionAt: latest?.createdAt || null,
      };
    }));

    res.json({
      success: true,
      data: enriched,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    logger.error('clinical/patients error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load patients' } });
  }
});

// ============================================================================
// PATIENT DETAIL
// ============================================================================
router.get('/patients/:id', ...clinician, async (req, res) => {
  try {
    const patient = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      role: 'EMPLOYEE',
    }).select('-passwordHash -salt -mfaSecret').lean();

    if (!patient) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

    // Load recent sessions
    const sessions = await Session.find({ patientId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('vocalysisScore emotionalState duration status createdAt preSessionForm postSessionForm')
      .lean();

    // Load consultations
    const consultations = await Consultation.find({
      employeeId: req.params.id,
      clinicianId: req.user._id.toString(),
    })
      .sort({ scheduledAt: -1 })
      .lean();

    res.json({ success: true, data: { ...patient, sessions, consultations } });
  } catch (err) {
    logger.error('clinical/patients/:id error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load patient' } });
  }
});

// ============================================================================
// PRE-SESSION FORM — submit
// ============================================================================
router.post('/sessions/:sessionId/pre-form', requireAuth, async (req, res) => {
  try {
    const {
      // Patient wellbeing before session
      currentMoodScore, currentStressLevel, sleepQuality, sleepHours,
      energyLevel, anxietyLevel, mainConcern, recentLifeEvents,
      medicationChanges, physicalSymptoms, suicidalIdeation,
      sessionGoal, safetyCheck,
    } = req.body;

    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, error: { message: 'Session not found' } });

    session.preSessionForm = {
      currentMoodScore,
      currentStressLevel,
      sleepQuality,
      sleepHours,
      energyLevel,
      anxietyLevel,
      mainConcern,
      recentLifeEvents,
      medicationChanges,
      physicalSymptoms,
      suicidalIdeation: suicidalIdeation || false,
      sessionGoal,
      safetyCheck: safetyCheck || 'safe',
      submittedAt: new Date(),
    };
    await session.save();

    res.json({ success: true, message: 'Pre-session form saved', data: session.preSessionForm });
  } catch (err) {
    logger.error('pre-session form error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to save pre-session form' } });
  }
});

// ============================================================================
// POST-SESSION FORM — submit
// ============================================================================
router.post('/sessions/:sessionId/post-form', requireAuth, async (req, res) => {
  try {
    const {
      // Clinician observations after session
      sessionType, sessionDuration, presentingIssues, therapeuticApproach,
      patientEngagement, progressNotes, clinicalObservations,
      riskAssessment, riskLevel, safetyPlan,
      diagnosisCodes, treatmentGoals, nextSteps,
      followUpRequired, followUpTimeframe, referralNeeded,
      sessionRating, clinicianNotes,
      // Patient self-report after session
      postMoodScore, postStressLevel, sessionHelpfulness, patientFeedback,
    } = req.body;

    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, error: { message: 'Session not found' } });

    session.postSessionForm = {
      sessionType,
      sessionDuration,
      presentingIssues,
      therapeuticApproach,
      patientEngagement,
      progressNotes,
      clinicalObservations,
      riskAssessment,
      riskLevel: riskLevel || 'low',
      safetyPlan,
      diagnosisCodes,
      treatmentGoals,
      nextSteps,
      followUpRequired: followUpRequired || false,
      followUpTimeframe,
      referralNeeded: referralNeeded || false,
      sessionRating,
      clinicianNotes,
      postMoodScore,
      postStressLevel,
      sessionHelpfulness,
      patientFeedback,
      submittedAt: new Date(),
    };
    session.status = 'completed';
    session.reviewedBy = req.user._id.toString();
    await session.save();

    res.json({ success: true, message: 'Post-session form saved', data: session.postSessionForm });
  } catch (err) {
    logger.error('post-session form error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to save post-session form' } });
  }
});

module.exports = router;
