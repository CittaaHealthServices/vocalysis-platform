/**
 * /my/* routes â Employee self-service endpoints
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

    // Latest sessions for mood trend
    const recentSessions = await Session.find({ patientId: userId })
      .sort({ createdAt: -1 })
      .limit(7)
      .select('vocalysisScore emotionalState createdAt')
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

    // Streak (consecutive days with a session)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const hasSession = await Session.exists({ patientId: userId, createdAt: { $gte: day, $lt: next } });
      if (hasSession) streak++;
      else break;
    }

    const latestScore = recentSessions[0]?.vocalysisScore || null;

    res.json({
      success: true,
      data: {
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
        wellnessScore: latestScore,
        streak,
        recentSessions: recentSessions.map(s => ({
          date: s.createdAt,
          score: s.vocalysisScore,
          mood: s.emotionalState,
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
        .select('vocalysisScore emotionalState duration status createdAt')
        .lean(),
      Session.countDocuments({ patientId: userId }),
    ]);

    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s._id,
        date: s.createdAt,
        score: s.vocalysisScore,
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

module.exports = router;
