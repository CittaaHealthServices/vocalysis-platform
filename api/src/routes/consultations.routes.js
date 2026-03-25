const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const Session = require('../models/Session');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const googleService = require('../services/googleService');
const { addHours, format, parseISO } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

/**
 * GET /consultations
 * List consultations for current user's scope
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, employeeId } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    let query = { tenantId };

    // Filter by role
    if (userRole === 'EMPLOYEE') {
      query.employeeId = userId;
    } else if (userRole === 'CLINICIAN') {
      query.clinicianId = userId;
    }

    // Additional filters
    if (status) {
      query.status = status;
    }

    if (employeeId && (userRole === 'HR_ADMIN' || userRole === 'COMPANY_ADMIN')) {
      query.employeeId = employeeId;
    }

    const skip = (page - 1) * limit;

    const [consultations, total] = await Promise.all([
      Consultation.find(query)
        .populate('employeeId', 'firstName lastName email')
        .populate('clinicianId', 'firstName lastName email')
        .populate('sessionId', 'vocacoreResults createdAt')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Consultation.countDocuments(query)
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATIONS_LISTED',
      targetResource: 'Consultation',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      consultations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Failed to list consultations', { error: err.message });
    res.status(500).json({ error: 'Failed to list consultations' });
  }
});

/**
 * POST /consultations
 * Create consultation with optional Google Calendar integration
 */
router.post('/', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const {
      sessionId,
      employeeId,
      clinicianId,
      consultationType,
      mode,
      scheduledAt,
      durationMinutes,
      location,
      notes
    } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    // Validate required fields
    if (!employeeId || !clinicianId || !consultationType || !mode || !scheduledAt || !durationMinutes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate mode
    if (!['online', 'inperson'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be online or inperson' });
    }

    // Fetch employee and clinician
    const [employee, clinician, tenant] = await Promise.all([
      User.findById(employeeId),
      User.findById(clinicianId),
      Tenant.findById(tenantId)
    ]);

    if (!employee || !clinician) {
      return res.status(404).json({ error: 'Employee or clinician not found' });
    }

    // Create consultation
    const consultation = new Consultation({
      tenantId,
      sessionId,
      employeeId,
      clinicianId,
      consultationType,
      mode,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      location,
      notes,
      status: 'scheduled',
      createdBy: userId,
      createdAt: new Date()
    });

    // Handle Google Calendar integration for online mode
    let googleEventData = null;
    if (mode === 'online' && tenant?.googleConfig?.autoCreateMeetLinks && clinician.googleProfile?.accessToken) {
      try {
        const endDateTime = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60000);

        googleEventData = await googleService.createConsultationEvent({
          organizerEmail: clinician.email,
          organizerRefreshToken: clinician.googleProfile.refreshToken,
          attendeeEmails: [employee.email, clinician.email],
          title: `Wellness Consultation - ${employee.firstName} ${employee.lastName}`,
          description: `VocaCore™ Wellness Consultation\n\nConsultant: ${clinician.firstName} ${clinician.lastName}\nEmployee: ${employee.firstName} ${employee.lastName}\n\n${notes || ''}`,
          startDateTime: new Date(scheduledAt).toISOString(),
          endDateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Kolkata',
          addGoogleMeet: true
        });

        consultation.googleMeet = {
          eventId: googleEventData.eventId,
          meetLink: googleEventData.meetLink,
          meetId: googleEventData.meetId,
          htmlLink: googleEventData.htmlLink
        };
      } catch (err) {
        logger.error('Failed to create Google Calendar event', { error: err.message });
        // Continue without Google event
      }
    }

    await consultation.save();

    // Send invitation emails
    const scheduledTime = new Date(scheduledAt);
    const consultationTimeStr = scheduledTime.toLocaleString('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const meetLink = googleEventData?.meetLink || null;
    const calendarLink = googleEventData?.htmlLink || null;

    // Email to employee
    await emailService.sendConsultationInvite({
      to: employee.email,
      consultation: { ...consultation.toObject(), scheduledAt: consultationTimeStr },
      meetLink,
      calendarLink
    }).catch(err => logger.error('Employee consultation invite failed', { error: err.message }));

    // Email to clinician
    await emailService.sendConsultationInvite({
      to: clinician.email,
      consultation: { ...consultation.toObject(), scheduledAt: consultationTimeStr },
      meetLink,
      calendarLink
    }).catch(err => logger.error('Clinician consultation invite failed', { error: err.message }));

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATION_CREATED',
      targetResource: 'Consultation',
      targetId: consultation._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: {
        employeeId,
        clinicianId,
        mode,
        scheduledAt,
        hasGoogleMeet: !!googleEventData
      }
    });

    res.status(201).json({
      message: 'Consultation created successfully',
      consultation: consultation.toObject()
    });
  } catch (err) {
    logger.error('Failed to create consultation', { error: err.message });
    res.status(500).json({ error: 'Failed to create consultation' });
  }
});

/**
 * GET /consultations/:id
 * Get single consultation with full details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const consultation = await Consultation.findById(id)
      .populate('employeeId')
      .populate('clinicianId')
      .populate('sessionId');

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Check authorization
    if (consultation.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (userRole === 'EMPLOYEE' && consultation.employeeId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (userRole === 'CLINICIAN' && consultation.clinicianId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATION_VIEWED',
      targetResource: 'Consultation',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ consultation });
  } catch (err) {
    logger.error('Failed to fetch consultation', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

/**
 * PUT /consultations/:id
 * Update consultation (reschedule, notes, status)
 */
router.put('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt, notes, status, durationMinutes } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Check authorization
    if (consultation.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const originalData = consultation.toObject();

    // Update fields
    if (scheduledAt) {
      consultation.scheduledAt = new Date(scheduledAt);
    }
    if (notes !== undefined) {
      consultation.notes = notes;
    }
    if (status) {
      consultation.status = status;
    }
    if (durationMinutes) {
      consultation.durationMinutes = durationMinutes;
    }

    // If rescheduling and has Google event, update calendar event
    if (scheduledAt && consultation.googleMeet?.eventId) {
      try {
        const clinician = await User.findById(consultation.clinicianId);
        const endDateTime = new Date(new Date(scheduledAt).getTime() + consultation.durationMinutes * 60000);

        await googleService.updateConsultationEvent({
          eventId: consultation.googleMeet.eventId,
          calendarId: 'primary',
          organizerRefreshToken: clinician.googleProfile.refreshToken,
          updates: {
            start: {
              dateTime: new Date(scheduledAt).toISOString(),
              timeZone: 'Asia/Kolkata'
            },
            end: {
              dateTime: endDateTime.toISOString(),
              timeZone: 'Asia/Kolkata'
            }
          }
        });
      } catch (err) {
        logger.error('Failed to update Google Calendar event', { error: err.message });
      }
    }

    await consultation.save();

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATION_UPDATED',
      targetResource: 'Consultation',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: {
        before: { scheduledAt: originalData.scheduledAt, notes: originalData.notes, status: originalData.status },
        after: { scheduledAt: consultation.scheduledAt, notes: consultation.notes, status: consultation.status }
      }
    });

    res.json({ message: 'Consultation updated', consultation });
  } catch (err) {
    logger.error('Failed to update consultation', { error: err.message });
    res.status(500).json({ error: 'Failed to update consultation' });
  }
});

/**
 * DELETE /consultations/:id
 * Cancel consultation
 */
router.delete('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Check authorization
    if (consultation.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Cancel Google Calendar event if exists
    if (consultation.googleMeet?.eventId) {
      try {
        const clinician = await User.findById(consultation.clinicianId);
        await googleService.cancelConsultationEvent({
          eventId: consultation.googleMeet.eventId,
          calendarId: 'primary',
          organizerRefreshToken: clinician.googleProfile.refreshToken,
          sendNotifications: true
        });
      } catch (err) {
        logger.error('Failed to cancel Google Calendar event', { error: err.message });
      }
    }

    // Update consultation status
    consultation.status = 'cancelled';
    consultation.cancelledBy = userId;
    consultation.cancellationReason = reason;
    consultation.cancelledAt = new Date();
    await consultation.save();

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATION_CANCELLED',
      targetResource: 'Consultation',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { reason }
    });

    res.json({ message: 'Consultation cancelled', consultation });
  } catch (err) {
    logger.error('Failed to cancel consultation', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel consultation' });
  }
});

/**
 * POST /consultations/:id/complete
 * Mark consultation as complete with notes
 */
router.post('/:id/complete', requireAuth, requireRole(['CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { clinicianNotes } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Check authorization
    if (consultation.clinicianId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the clinician can complete this consultation' });
    }

    consultation.status = 'completed';
    consultation.clinicianNotes = clinicianNotes;
    consultation.completedAt = new Date();
    await consultation.save();

    // If there's a session, update it with clinician notes
    if (consultation.sessionId) {
      await Session.findByIdAndUpdate(
        consultation.sessionId,
        { clinicianNotes }
      );
    }

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'CONSULTATION_COMPLETED',
      targetResource: 'Consultation',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { clinicianNotes }
    });

    res.json({ message: 'Consultation marked as complete', consultation });
  } catch (err) {
    logger.error('Failed to complete consultation', { error: err.message });
    res.status(500).json({ error: 'Failed to complete consultation' });
  }
});

/**
 * GET /consultations/availability/:clinicianId
 * Get clinician's available slots
 */
router.get('/availability/:clinicianId', requireAuth, async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const { date, duration } = req.query;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    if (!date || !duration) {
      return res.status(400).json({ error: 'Date and duration required' });
    }

    const clinician = await User.findById(clinicianId);
    if (!clinician || !clinician.googleProfile?.refreshToken) {
      return res.status(400).json({ error: 'Clinician has no Google Calendar connected' });
    }

    // Get time bounds for the day
    const selectedDate = new Date(date);
    const timeMin = new Date(selectedDate);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(selectedDate);
    timeMax.setHours(23, 59, 59, 999);

    // Get free/busy information
    const { freeSlots } = await googleService.getFreeBusy({
      calendarIds: ['primary'],
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      refreshToken: clinician.googleProfile.refreshToken
    });

    // Filter slots by duration
    const availableSlots = freeSlots.filter(slot => {
      const slotDuration = (new Date(slot.end) - new Date(slot.start)) / (1000 * 60);
      return slotDuration >= parseInt(duration);
    });

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'AVAILABILITY_CHECKED',
      targetResource: 'Consultation',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ availableSlots });
  } catch (err) {
    logger.error('Failed to get availability', { error: err.message });
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

module.exports = router;
