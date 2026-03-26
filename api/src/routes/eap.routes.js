/**
 * /eap/* routes — EAP Provider endpoints
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Consultation = require('../models/Consultation');
const Session = require('../models/Session');
const logger = require('../utils/logger');

const eapProvider = [requireAuth, requireRole(['EAP_PROVIDER'])];

// GET /eap/dashboard
router.get('/dashboard', ...eapProvider, async (req, res) => {
  try {
    const providerId = req.user._id.toString();
    const { tenantId } = req.user;

    const [totalClients, upcomingConsultations, completedSessions] = await Promise.all([
      User.countDocuments({ tenantId, role: 'EMPLOYEE', isActive: true }),
      Consultation.countDocuments({
        clinicianId: providerId,
        status: { $in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { $gte: new Date() },
      }),
      Consultation.countDocuments({ clinicianId: providerId, status: 'COMPLETED' }),
    ]);

    // Today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayConsultations = await Consultation.find({
      clinicianId: providerId,
      scheduledAt: { $gte: today, $lt: tomorrow },
    })
      .populate('employeeId', 'firstName lastName email')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        totalClients,
        upcomingConsultations,
        completedSessions,
        todaySchedule: todayConsultations.map(c => ({
          id: c._id,
          client: c.employeeId
            ? `${c.employeeId.firstName} ${c.employeeId.lastName}`.trim()
            : 'Client',
          scheduledAt: c.scheduledAt,
          type: c.type || 'online',
          status: c.status,
          meetLink: c.googleMeet?.meetLink || null,
        })),
        resources: [
          { id: 1, title: 'Stress Management Guide', type: 'article', downloads: 142 },
          { id: 2, title: 'Mindfulness for Work', type: 'video', downloads: 89 },
          { id: 3, title: 'Sleep Hygiene Tips', type: 'article', downloads: 73 },
        ],
        webinars: [
          { id: 1, title: 'Burnout Prevention', date: new Date(Date.now() + 7 * 86400000), registrations: 24 },
          { id: 2, title: 'Mindful Leadership', date: new Date(Date.now() + 14 * 86400000), registrations: 18 },
        ],
      },
    });
  } catch (err) {
    logger.error('eap/dashboard error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load EAP dashboard' } });
  }
});

module.exports = router;
