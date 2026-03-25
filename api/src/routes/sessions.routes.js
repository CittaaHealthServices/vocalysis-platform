const express = require('express');
const router = express.Router();
const multer = require('multer');
const Session = require('../models/Session');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const featureExtractionService = require('../services/featureExtractionService');
const vocacoreEngine = require('../services/vocacoreEngine');
const alertEngine = require('../services/alertEngine');
const pdfGenerator = require('../services/pdfGenerator');
const Bull = require('bull');

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

// Job queue for background processing
const assessmentQueue = new Bull('assessments', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

/**
 * POST /sessions
 * Create and process new assessment session
 */
router.post('/', requireAuth, requireRole(['EMPLOYEE', 'HR_ADMIN', 'CLINICIAN']), upload.single('audio'), async (req, res) => {
  try {
    const { employeeId, notes } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    // Determine target employee
    let targetEmployeeId = employeeId;
    if (userRole === 'EMPLOYEE') {
      targetEmployeeId = userId;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    // Validate audio file
    try {
      featureExtractionService.validateAudioBuffer(req.file.buffer, req.file.mimetype);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Get employee and tenant
    const [employee, tenant] = await Promise.all([
      User.findById(targetEmployeeId),
      Tenant.findById(tenantId)
    ]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check tenant quota
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const usedAssessments = await Session.countDocuments({
      tenantId,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    if (usedAssessments >= tenant.monthlyAssessmentQuota) {
      return res.status(429).json({ error: 'Monthly assessment quota reached' });
    }

    // Create session document
    const session = new Session({
      tenantId,
      employeeId: targetEmployeeId,
      createdBy: userId,
      audioFileName: req.file.originalname,
      audioMimeType: req.file.mimetype,
      audioFileSize: req.file.size,
      notes,
      status: 'processing',
      createdAt: new Date()
    });

    await session.save();

    // Queue assessment job
    try {
      await assessmentQueue.add({
        sessionId: session._id,
        audioBuffer: req.file.buffer,
        audioFileName: req.file.originalname,
        tenantId,
        employeeId: targetEmployeeId,
        userId,
        requestId
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    } catch (err) {
      logger.error('Failed to queue assessment job', { error: err.message });
      session.status = 'failed';
      session.errorMessage = 'Failed to queue processing';
      await session.save();
      return res.status(500).json({ error: 'Failed to process assessment' });
    }

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'SESSION_CREATED',
      targetResource: 'Session',
      targetId: session._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: {
        employeeId: targetEmployeeId,
        audioFileName: req.file.originalname,
        audioSize: req.file.size
      }
    });

    res.status(201).json({
      message: 'Assessment session created and queued for processing',
      session: {
        id: session._id,
        status: session.status,
        employeeId: session.employeeId,
        createdAt: session.createdAt
      }
    });
  } catch (err) {
    logger.error('Failed to create session', { error: err.message });
    await auditService.log({
      userId: req.user._id,
      tenantId: req.user.tenantId,
      role: req.user.role,
      action: 'SESSION_CREATED',
      targetResource: 'Session',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      outcome: 'failure',
      errorMessage: err.message
    });
    res.status(500).json({ error: 'Failed to create assessment session' });
  }
});

/**
 * Assessment job processor
 */
assessmentQueue.process(async (job) => {
  const { sessionId, audioBuffer, audioFileName, tenantId, employeeId, userId, requestId } = job.data;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Extract features
    logger.info('Extracting audio features', { sessionId });
    const features = await featureExtractionService.extract(audioBuffer, audioFileName);
    session.audioFeatures = features;

    // Analyze with VocaCore
    logger.info('Running VocaCore analysis', { sessionId });
    const vocacoreResults = await vocacoreEngine.analyze(features);
    session.vocacoreResults = vocacoreResults;

    // Generate wellnessOutput for employee
    session.employeeWellnessOutput = {
      overallScore: Math.round((100 - vocacoreResults.stress_score) / 2 + vocacoreResults.confidence_score / 2),
      stressLevel: vocacoreResults.stress_score > 75 ? 'high' : vocacoreResults.stress_score > 50 ? 'moderate' : 'low',
      recommendedActions: _generateEmployeeRecommendations(vocacoreResults),
      nextCheckupDays: vocacoreResults.recommended_followup_weeks * 7,
      generatedAt: new Date()
    };

    // Evaluate for alerts
    const tenant = await Tenant.findById(tenantId);
    const alertResult = await alertEngine.evaluateSession(session, tenant);

    if (alertResult.alertCreated) {
      const employee = await User.findById(employeeId);
      const hrAdmins = await User.find({
        tenantId,
        role: { $in: ['HR_ADMIN', 'COMPANY_ADMIN'] }
      });

      // Notify HR admins
      for (const hrAdmin of hrAdmins) {
        await emailService.sendAlertNotification({
          to: hrAdmin.email,
          alert: { alertLevel: alertResult.alertLevel, triggeringScores: [] },
          employee,
          tenantName: tenant.name
        }).catch(err => logger.error('Alert notification email failed', { error: err.message }));
      }
    }

    // Mark session as complete
    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    logger.info('Assessment processing completed', { sessionId, alertCreated: alertResult.alertCreated });

    await auditService.log({
      userId,
      tenantId,
      role: 'SYSTEM',
      action: 'SESSION_PROCESSED',
      targetResource: 'Session',
      targetId: sessionId,
      requestId,
      changeSnapshot: {
        featuresExtracted: true,
        vocacoreAnalyzed: true,
        alertCreated: alertResult.alertCreated
      }
    });

    return {
      success: true,
      sessionId,
      alertCreated: alertResult.alertCreated
    };
  } catch (err) {
    logger.error('Assessment processing failed', { error: err.message, sessionId });

    const session = await Session.findById(sessionId);
    if (session) {
      session.status = 'failed';
      session.errorMessage = err.message;
      await session.save();
    }

    throw err;
  }
});

/**
 * GET /sessions
 * List sessions (scoped by role and tenant)
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
    } else if (employeeId && (userRole === 'HR_ADMIN' || userRole === 'COMPANY_ADMIN' || userRole === 'CLINICIAN')) {
      query.employeeId = employeeId;
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .populate('employeeId', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Session.countDocuments(query)
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'SESSIONS_LISTED',
      targetResource: 'Session',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Failed to list sessions', { error: err.message });
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /sessions/:id
 * Get session with full details (role-based data visibility)
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const session = await Session.findById(id)
      .populate('employeeId')
      .populate('createdBy');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check authorization
    if (session.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (userRole === 'EMPLOYEE' && session.employeeId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Return role-appropriate data
    const responseData = { session };

    if (userRole === 'EMPLOYEE') {
      // Employees only see wellness output
      responseData.session = {
        id: session._id,
        status: session.status,
        createdAt: session.createdAt,
        employeeWellnessOutput: session.employeeWellnessOutput
      };
    }
    // Clinical roles see full data

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'SESSION_VIEWED',
      targetResource: 'Session',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json(responseData);
  } catch (err) {
    logger.error('Failed to fetch session', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * PUT /sessions/:id/finalise
 * Clinician finalizes session and generates PDF
 */
router.put('/:id/finalise', requireAuth, requireRole(['CLINICIAN', 'HR_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { clinicianNotes } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const session = await Session.findById(id)
      .populate('employeeId');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check authorization
    if (session.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Session must be completed before finalizing' });
    }

    // Add clinician notes
    if (clinicianNotes) {
      session.clinicianNotes = clinicianNotes;
    }

    // Generate PDF
    const clinician = await User.findById(userId);
    const tenant = await Tenant.findById(tenantId);

    const pdfBuffer = await pdfGenerator.generateSessionReport(
      session,
      session.employeeId,
      clinician,
      tenant
    );

    session.reportGenerated = true;
    session.reportGeneratedAt = new Date();
    session.status = 'finalised';
    await session.save();

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'SESSION_FINALISED',
      targetResource: 'Session',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      message: 'Session finalized',
      session,
      reportSize: pdfBuffer.length
    });
  } catch (err) {
    logger.error('Failed to finalize session', { error: err.message });
    res.status(500).json({ error: 'Failed to finalize session' });
  }
});

/**
 * GET /sessions/:id/report
 * Download PDF report
 */
router.get('/:id/report', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;

    const session = await Session.findById(id)
      .populate('employeeId');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check authorization
    if (session.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (userRole === 'EMPLOYEE' && session.employeeId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!session.reportGenerated) {
      return res.status(404).json({ error: 'Report not yet generated' });
    }

    const clinician = await User.findById(session.createdBy);
    const tenant = await Tenant.findById(tenantId);

    const pdfBuffer = await pdfGenerator.generateSessionReport(
      session,
      session.employeeId,
      clinician,
      tenant
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="session_${session._id}_report.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Failed to download report', { error: err.message });
    res.status(500).json({ error: 'Failed to download report' });
  }
});

/**
 * DELETE /sessions/:id
 * Soft delete session (CITTAA_SUPER_ADMIN only)
 */
router.delete('/:id', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.deletedAt = new Date();
    session.deletedBy = userId;
    session.deletionReason = reason;
    await session.save();

    await auditService.log({
      userId,
      tenantId,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'SESSION_DELETED',
      targetResource: 'Session',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { reason }
    });

    res.json({ message: 'Session deleted' });
  } catch (err) {
    logger.error('Failed to delete session', { error: err.message });
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * Helper: Generate employee wellness recommendations
 */
function _generateEmployeeRecommendations(results) {
  const recommendations = [];

  if (results.stress_score > 75) {
    recommendations.push('Try stress-reduction techniques like meditation or deep breathing');
  }

  if (results.anxiety_score > 65) {
    recommendations.push('Consider mindfulness exercises or speaking with a counselor');
  }

  if (results.confidence_score < 50) {
    recommendations.push('Engage in activities that boost confidence and self-esteem');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue maintaining your current wellness routine');
  }

  return recommendations;
}

module.exports = router;
