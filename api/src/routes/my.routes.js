/**
 * /my/* routes — Employee self-service endpoints
 * All routes require authentication as EMPLOYEE (or any authenticated user accessing their own data)
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Session = require('../models/Session');
const Consultation = require('../models/Consultation');
const logger = require('../utils/logger');

// ============================================================================
// WELLNESS DASHBOARD (employee home)
// ============================================================================
router.get('/wellness', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const userDoc = await User.findOne({ userId }).select('firstName lastName').lean();

    // Latest completed sessions — use employeeWellnessOutput.wellnessScore (correct stored field)
    const recentSessions = await Session.find({ patientId: userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(7)
      .select('employeeWellnessOutput vocacoreResults emotionalState createdAt status')
      .lean();

    // Upcoming consultations
    const upcomingConsultations = await Consultation.find({
      employeeId: userId,
      status: { $in: ['scheduled', 'confirmed'] },
      scheduledAt: { $gte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(3)
      .populate('clinicianId', 'firstName lastName')
      .lean();

    // Streak (consecutive days with a completed session)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const hasSession = await Session.exists({ patientId: userId, status: 'completed', createdAt: { $gte: day, $lt: next } });
      if (hasSession) streak++;
      else break;
    }

    const latestScore = recentSessions[0]?.employeeWellnessOutput?.wellnessScore ?? null;
    const prevScore   = recentSessions[1]?.employeeWellnessOutput?.wellnessScore ?? null;
    const trend = latestScore == null || prevScore == null
      ? 'stable'
      : latestScore > prevScore + 3 ? 'improving'
      : latestScore < prevScore - 3 ? 'declining'
      : 'stable';

    res.json({
      success: true,
      data: {
        firstName: userDoc?.firstName || '',
        lastName: userDoc?.lastName || '',
        wellnessScore: latestScore,
        trend,
        streak,
        latestDimensionalScores: recentSessions[0]?.vocacoreResults?.dimensionalScores || null,
        latestRiskLevel: recentSessions[0]?.vocacoreResults?.overallRiskLevel || null,
        latestWellnessLevel: recentSessions[0]?.employeeWellnessOutput?.wellnessLevel || null,
        recentSessions: recentSessions.map(s => ({
          date: s.createdAt,
          score: s.employeeWellnessOutput?.wellnessScore ?? null,
          wellnessLevel: s.employeeWellnessOutput?.wellnessLevel ?? null,
          riskLevel: s.vocacoreResults?.overallRiskLevel ?? null,
        })),
        upcomingConsultations: upcomingConsultations.map(c => ({
          id: c._id,
          clinician: c.clinicianId
            ? `${c.clinicianId.firstName} ${c.clinicianId.lastName}`.trim()
            : 'Clinician',
          scheduledAt: c.scheduledAt,
          type: c.type || 'online',
          meetLink: c.googleMeet?.meetLink || null,
        })),
      },
    });
  } catch (err) {
    logger.error('my/wellness error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load wellness data' } });
  }
});

// ============================================================================
// HISTORY
// ============================================================================
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [sessions, total] = await Promise.all([
      Session.find({ patientId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('employeeWellnessOutput vocacoreResults emotionalState duration status createdAt')
        .lean(),
      Session.countDocuments({ patientId: userId }),
    ]);

    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s._id,
        date: s.createdAt,
        score: s.employeeWellnessOutput?.wellnessScore ?? null,
        wellnessLevel: s.employeeWellnessOutput?.wellnessLevel ?? null,
        riskLevel: s.vocacoreResults?.overallRiskLevel ?? null,
        mood: s.emotionalState,
        duration: s.duration,
        status: s.status,
      })),
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    logger.error('my/history error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load history' } });
  }
});

// ============================================================================
// MY CONSULTATIONS
// ============================================================================
router.get('/consultations', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const consultations = await Consultation.find({ employeeId: userId })
      .sort({ scheduledAt: -1 })
      .populate('clinicianId', 'firstName lastName clinicianProfile')
      .lean();

    res.json({
      success: true,
      data: consultations.map(c => ({
        id: c._id,
        clinician: c.clinicianId
          ? `${c.clinicianId.firstName} ${c.clinicianId.lastName}`.trim()
          : 'Clinician',
        clinicianSpecialisation: c.clinicianId?.clinicianProfile?.specialisation || null,
        scheduledAt: c.scheduledAt,
        type: c.type || 'online',
        status: c.status,
        meetLink: c.googleMeet?.meetLink || null,
        notes: c.employeeNotes || null,
      })),
    });
  } catch (err) {
    logger.error('my/consultations error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load consultations' } });
  }
});

// ============================================================================
// MY PROFILE
// ============================================================================
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId || req.user._id })
      .select('firstName lastName email phone profilePhotoUrl gender dateOfBirth employeeId departmentId jobTitle notificationPreferences consentRecord')
      .lean();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to load profile' } });
  }
});

// ============================================================================
// CRISIS SOS
// An employee can self-report a crisis — creates a critical alert immediately
// and notifies assigned psychologists. Rate-limited to 1 per hour to prevent
// accidental repeats.
// ============================================================================
router.post('/sos', requireAuth, async (req, res) => {
  try {
    const Alert = require('../models/Alert');
    const userId   = (req.user.userId || req.user._id).toString();
    const tenantId = req.user.tenantId;
    const { message: userMessage, contactMe = true } = req.body;

    // Rate-limit: block if a SOS was created within the last 60 min
    const recentSOS = await Alert.findOne({
      employeeId: userId,
      alertType:  'crisis_alert',
      'metadata.source': 'employee_sos',
      triggeredAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    }).lean();

    if (recentSOS) {
      return res.status(429).json({
        success: false,
        error: { message: 'A support request was already raised in the last hour. Your care team has been notified and will reach out shortly.' },
      });
    }

    // Create crisis alert
    const alert = await Alert.create({
      tenantId,
      employeeId: userId,
      alertType:  'crisis_alert',
      severity:   'critical',
      title:      'Employee Crisis SOS — Immediate Support Requested',
      message:    userMessage
        ? `Employee has requested immediate support: "${userMessage}"`
        : 'Employee has activated the Crisis SOS button and is requesting immediate support.',
      riskDetails: {
        riskLevel: 'red',
        riskScore: 100,
      },
      status:      'new',
      triggeredAt: new Date(),
      metadata: {
        source:          'employee_sos',
        contactMeFlag:   contactMe,
        selfReported:    true,
        triggerThreshold: 'manual_sos',
      },
    });

    // Try to find psychologists in this tenant and create notifications
    try {
      const emailService = require('../services/emailService');
      const User = require('../models/User');
      const psychologists = await User.find({
        tenantId,
        role: { $in: ['SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'] },
        isActive: true,
      }).select('email firstName lastName').lean();

      const employee = await User.findById(userId).select('firstName lastName email').lean();

      for (const psych of psychologists) {
        await emailService.sendAlertNotification?.({
          to: psych.email,
          subject: '🚨 Crisis SOS — Immediate Attention Required',
          clinicianName: `${psych.firstName} ${psych.lastName}`,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'An employee',
          message: userMessage || 'Employee has activated the crisis SOS.',
          alertId: alert._id,
          priority: 'critical',
        }).catch(() => {}); // non-fatal
      }
    } catch (notifyErr) {
      // Non-fatal: alert was created, notification failure shouldn't block response
    }

    res.status(201).json({
      success: true,
      data: {
        alertId:  alert._id,
        message:  'Your support request has been received. A member of your care team will reach out to you as soon as possible.',
        severity: 'critical',
      },
    });
  } catch (err) {
    logger.error('my/sos error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to submit support request' } });
  }
});

// ============================================================================
// PERSONAL VOCOSCALE™ PROGRESS
// Returns the employee's own PHQ-9 / GAD-7 / PSS-10 history for
// the personal progress page (friendlier data shape than /history).
// ============================================================================
router.get('/vocoscale', requireAuth, async (req, res) => {
  try {
    const userId = (req.user.userId || req.user._id).toString();
    const { weeks = 12 } = req.query;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(weeks) * 7);

    const sessions = await Session.find({
      patientId: userId,
      status:    'completed',
      createdAt: { $gte: fromDate },
    })
      .sort({ createdAt: 1 })
      .select('createdAt employeeWellnessOutput vocacoreResults')
      .lean();

    const history = sessions.map(s => ({
      date:         s.createdAt,
      wellness:     s.employeeWellnessOutput?.wellnessScore ?? null,
      wellnessLevel:s.employeeWellnessOutput?.wellnessLevel ?? null,
      riskLevel:    s.vocacoreResults?.overallRiskLevel ?? null,
      depression:   s.vocacoreResults?.dimensionalScores?.depression ?? null,
      anxiety:      s.vocacoreResults?.dimensionalScores?.anxiety    ?? null,
      stress:       s.vocacoreResults?.dimensionalScores?.stress     ?? null,
      burnout:      s.vocacoreResults?.dimensionalScores?.burnout    ?? null,
      phq9:         s.vocacoreResults?.standardScales?.phq9?.score   ?? null,
      phq9Tier:     s.vocacoreResults?.standardScales?.phq9?.tier    ?? null,
      gad7:         s.vocacoreResults?.standardScales?.gad7?.score   ?? null,
      gad7Tier:     s.vocacoreResults?.standardScales?.gad7?.tier    ?? null,
      pss10:        s.vocacoreResults?.standardScales?.pss10?.score  ?? null,
      pss10Tier:    s.vocacoreResults?.standardScales?.pss10?.tier   ?? null,
      clinicalFlag: s.vocacoreResults?.standardScales?.clinicalFlag  ?? null,
    }));

    // Latest snapshot
    const latest = history.at(-1) || null;

    // Week-over-week delta
    const prev = history.at(-2) || null;
    const wellnessDelta = (latest && prev && latest.wellness != null && prev.wellness != null)
      ? Math.round(latest.wellness - prev.wellness) : null;

    res.json({
      success: true,
      data: { history, latest, wellnessDelta, sessionCount: history.length },
    });
  } catch (err) {
    logger.error('my/vocoscale error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load VocoScale™ data' } });
  }
});

module.exports = router;
