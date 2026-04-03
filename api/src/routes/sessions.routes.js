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
const trendService = require('../services/trendService');
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
// ✅ Fix: queue name must match worker ('audio-analysis'), use REDIS_URL like the worker does
const assessmentQueue = new Bull('audio-analysis', process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);

/**
 * POST /sessions
 * Create and process new assessment session
 */
router.post('/', requireAuth, requireRole(['EMPLOYEE', 'HR_ADMIN', 'CLINICIAN']), upload.single('audio'), async (req, res) => {
  try {
    const { employeeId, notes } = req.body;
    // ✅ Fix: auth middleware sets req.user.userId (UUID), not req.user._id
    const userId = req.user.userId || req.user._id;
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

    // ✅ Fix: find by userId (UUID string) not MongoDB _id; find tenant by tenantId string
    const [employee, tenant] = await Promise.all([
      userRole === 'EMPLOYEE'
        ? User.findOne({ userId: targetEmployeeId })       // self-submit: match by uuid
        : (User.findOne({ userId: targetEmployeeId }) ||   // admin specifying another user
           User.findById(targetEmployeeId).catch(() => null)),
      Tenant.findOne({ tenantId }),                        // tenantId is string, not ObjectId
    ]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Check tenant monthly quota
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const usedAssessments = await Session.countDocuments({
      tenantId,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    if (tenant.monthlyAssessmentQuota && usedAssessments >= tenant.monthlyAssessmentQuota) {
      return res.status(429).json({ error: 'Monthly assessment quota reached' });
    }

    // ── Daily check-in limit: max 12 per employee per day ───────────────────
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');
    const todayEnd   = new Date(todayStr + 'T23:59:59.999Z');

    const todayCount = await Session.countDocuments({
      patientId: targetEmployeeId.toString(),
      tenantId,
      checkInDate: todayStr,
    });

    const DAILY_MAX = 12;
    const DAILY_MIN_INFO = 9; // informational — not enforced as a hard stop

    if (todayCount >= DAILY_MAX) {
      return res.status(429).json({
        error: `Daily check-in limit reached (${DAILY_MAX}/day). Please try again tomorrow.`,
        todayCount,
        dailyMax: DAILY_MAX,
      });
    }

    // Create session document
    const session = new Session({
      tenantId,
      patientId: targetEmployeeId.toString(), // required field in model
      employeeId: targetEmployeeId.toString(),
      createdBy: userId.toString(),
      audioFileName: req.file.originalname,
      audioMimeType: req.file.mimetype,
      audioFileSize: req.file.size,
      notes,
      status: 'processing',
      checkInDate: todayStr,
      checkInIndex: todayCount + 1,
      sessionDate: new Date(),
      audioMetadata: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedAt: new Date(),
        processingStartedAt: new Date(),
        processingStatus: 'processing',
      },
    });

    await session.save();

    // Queue assessment job
    try {
      await assessmentQueue.add({
        sessionId: session._id,
        // ✅ Fix: processor expects base64 string (uses Buffer.from(audioBuffer, 'base64'))
        audioBuffer: req.file.buffer.toString('base64'),
        // ✅ Fix: processor destructures 'filename', not 'audioFileName'
        filename: req.file.originalname,
        tenantId,
        // ✅ Fix: processor destructures 'patientId', not 'employeeId'
        patientId: targetEmployeeId,
        clinicianId: userRole !== 'EMPLOYEE' ? userId : undefined,
        userId,
        requestId,
        // Pass user's language preference for per-language ML calibration in VocaCore
        languageHint: employee?.languagePreference || null,
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
      action: 'ASSESSMENT_CREATE',
      targetResource: 'session',
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
        createdAt: session.createdAt,
        checkInIndex: session.checkInIndex,
        checkInDate: session.checkInDate,
      },
      dailyProgress: {
        todayCount: todayCount + 1,
        dailyMin: DAILY_MIN_INFO,
        dailyMax: DAILY_MAX,
        remaining: DAILY_MAX - (todayCount + 1),
        metDailyGoal: (todayCount + 1) >= DAILY_MIN_INFO,
      },
    });
  } catch (err) {
    logger.error('Failed to create session', { error: err.message });
    await auditService.log({
      userId: (req.user.userId || req.user._id)?.toString(),
      tenantId: req.user.tenantId,
      role: req.user.role,
      action: 'ASSESSMENT_CREATE',
      targetResource: 'session',
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
 * ✅ Fix: removed — the merry-tranquility worker service processes all jobs.
 * Having assessmentQueue.process() here too caused the API and worker to
 * compete for the same jobs; the API's processor crashed (VocoCore ENOTFOUND)
 * and set session.status='failed' before the worker could complete it.
 *
 * DISABLED — do not re-enable this block:
 * assessmentQueue.process(async (job) => {
 *   ... VocoCore calls that fail in production ...
 * });
 */
if (false) assessmentQueue.process(async (job) => {
  const { sessionId, audioBuffer, audioFileName, tenantId, employeeId, userId, requestId } = job.data;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Primary: send raw audio to VocoCore /score (Indian ML model, 96.4% accuracy)
    // This does feature extraction + ML inference in one call.
    logger.info('Running VocoCore ML analysis (Indian-calibrated)', { sessionId });
    let vocacoreResults;
    try {
      vocacoreResults = await vocacoreEngine.analyzeAudio(
        Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer),
        audioFileName
      );
      // Populate audioFeatures from ML response (saves a separate /extract call)
      if (vocacoreResults.extractedFeatures &&
          Object.keys(vocacoreResults.extractedFeatures).length > 0) {
        session.audioFeatures = vocacoreResults.extractedFeatures;
      } else {
        // ML service returned no features — run separate extraction as fallback
        logger.info('Extracting audio features separately', { sessionId });
        const features = await featureExtractionService.extract(audioBuffer, audioFileName);
        session.audioFeatures = features;
      }
    } catch (mlErr) {
      // /score completely unreachable — fall back to separate extract + analyze
      logger.warn('analyzeAudio failed, falling back to extract+analyze', {
        error: mlErr.message, sessionId
      });
      const features = await featureExtractionService.extract(audioBuffer, audioFileName);
      session.audioFeatures = features;
      vocacoreResults = await vocacoreEngine.analyze(features);
    }
    // Map VocoCore results → Session model shape
    const depScore  = vocacoreResults.depression_score  ?? 0;
    const anxScore  = vocacoreResults.anxiety_score     ?? 0;
    const strScore  = vocacoreResults.stress_score      ?? 0;
    const confScore = vocacoreResults.confidence_score  ?? 50;
    const riskLevel = vocacoreResults.risk_level || 'green';

    session.vocacoreResults = {
      overallRiskLevel: ['green','yellow','orange','red'].includes(riskLevel) ? riskLevel : 'green',
      riskScore:   Math.round((depScore + anxScore + strScore) / 3),
      confidence:  Math.round(confScore),
      dimensionalScores: {
        depression: Math.round(depScore),
        anxiety:    Math.round(anxScore),
        stress:     Math.round(strScore),
        burnout:    Math.round(strScore * 0.8),
        engagement: Math.round(100 - strScore * 0.5),
      },
      keyIndicators:           vocacoreResults.biomarker_findings || [],
      clinicalRecommendations: vocacoreResults.recommended_actions || [],
      algorithmVersion: vocacoreResults.model_version || 'v2.1-india',
      processedAt: new Date(),
    };

    // Populate audioMetadata.processingStatus
    session.audioMetadata = {
      ...(session.audioMetadata || {}),
      processingCompletedAt: new Date(),
      processingStatus: 'completed',
    };

    // Generate wellnessOutput for employee (mapped to model fields)
    session.employeeWellnessOutput = {
      wellnessScore:   Math.round((100 - strScore) * 0.6 + confScore * 0.4),
      wellnessLevel:   strScore > 75 ? 'in_crisis' : strScore > 55 ? 'at_risk' : strScore > 30 ? 'healthy' : 'thriving',
      personalizedRecommendations: _generateEmployeeRecommendations(vocacoreResults),
      actionItems:     vocacoreResults.recommended_actions || [],
      nextCheckInDate: new Date(Date.now() + (vocacoreResults.recommended_followup_weeks || 1) * 7 * 86400000),
    };

    // Evaluate for alerts
    const tenant = await Tenant.findOne({ tenantId });
    const alertResult = await alertEngine.evaluateSession(session, tenant);

    if (alertResult.alertCreated) {
      const employee = await User.findOne({ userId: employeeId }).catch(() => User.findById(employeeId).catch(() => null));
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
    await session.save();

    logger.info('Assessment processing completed', { sessionId, alertCreated: alertResult.alertCreated });

    // ── Notify Cittaa super-admins that a member completed an assessment ──────
    emailService.sendMemberActivityNotification({
      session,
      tenantName: tenant?.displayName || tenant?.name || tenantId,
    }).catch(err => logger.error('Admin member-activity notification failed', { error: err.message }));
    // ─────────────────────────────────────────────────────────────────────────

    await auditService.log({
      userId,
      tenantId,
      role: 'SYSTEM',
      action: 'ASSESSMENT_COMPLETE',
      targetResource: 'session',
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
      session.audioMetadata = { ...(session.audioMetadata || {}), processingStatus: 'failed' };
      await session.save();
    }

    throw err;
  }
}); // end of disabled block

/**
 * GET /sessions/daily-progress
 * How many check-ins has the current employee done today?
 */
router.get('/daily-progress', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const tenantId = req.user.tenantId;
    const todayStr = new Date().toISOString().slice(0, 10);
    const DAILY_MIN = 9;
    const DAILY_MAX = 12;

    const todayCount = await Session.countDocuments({
      patientId: userId.toString(),
      tenantId,
      checkInDate: todayStr,
    });

    res.json({
      todayCount,
      dailyMin: DAILY_MIN,
      dailyMax: DAILY_MAX,
      remaining: Math.max(0, DAILY_MAX - todayCount),
      metDailyGoal: todayCount >= DAILY_MIN,
      canCheckIn: todayCount < DAILY_MAX,
    });
  } catch (err) {
    logger.error('Failed to fetch daily progress', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch daily progress' });
  }
});

/**
 * GET /sessions
 * List sessions (scoped by role and tenant)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, employeeId } = req.query;
    const userId = req.user.userId || req.user._id;
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
      action: 'SESSION_VIEW',
      targetResource: 'session',
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
    const userId = req.user.userId || req.user._id;
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

    // ✅ Fix: session.employeeId is a UUID string, not a populated object
    const sessionEmpId = session.employeeId?._id?.toString() || session.employeeId?.toString();
    if (userRole === 'EMPLOYEE' && sessionEmpId !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Return role-appropriate data
    const responseData = { session };

    if (userRole === 'EMPLOYEE') {
      // Employees see wellness output + anonymised vocacoreResults (no raw audio/clinical notes)
      responseData.session = {
        id: session._id,
        status: session.status,
        createdAt: session.createdAt,
        employeeWellnessOutput: session.employeeWellnessOutput,
        vocacoreResults: session.vocacoreResults
          ? {
              overallRiskLevel:   session.vocacoreResults.overallRiskLevel,
              riskScore:          session.vocacoreResults.riskScore,
              confidence:         session.vocacoreResults.confidence,
              dimensionalScores:  session.vocacoreResults.dimensionalScores,
              biomarkerFindings:  session.vocacoreResults.biomarkerFindings,
              algorithmVersion:   session.vocacoreResults.algorithmVersion,
              engineVersion:      session.vocacoreResults.engineVersion,
            }
          : null,
      };
    }
    // Clinical roles see full data

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'SESSION_VIEW',
      targetResource: 'session',
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
    const userId = req.user.userId || req.user._id;
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
    const tenant = await Tenant.findOne({ tenantId });

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
      action: 'REPORT_GENERATE',
      targetResource: 'session',
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
    const userId = req.user.userId || req.user._id;
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

    // ✅ Fix: session.employeeId is a UUID string, not a populated object
    const sessionEmpId = session.employeeId?._id?.toString() || session.employeeId?.toString();
    if (userRole === 'EMPLOYEE' && sessionEmpId !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!session.reportGenerated) {
      return res.status(404).json({ error: 'Report not yet generated' });
    }

    const clinician = await User.findById(session.createdBy);
    const tenant = await Tenant.findOne({ tenantId });

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
    const userId = req.user.userId || req.user._id;
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
      action: 'SESSION_DELETE',
      targetResource: 'session',
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
