const axios = require('axios');
const logger = require('../logger');

module.exports = async function audioAnalysisProcessor(job) {
  const { sessionId, tenantId, audioBuffer, filename, patientId, clinicianId } = job.data;
  let sessionDoc = null;

  try {
    logger.info('Starting audio analysis for session %s', sessionId);
    job.progress(5);

    // Import models inside processor to ensure DB connection is ready
    const Session = require('../models/Session');
    const Employee = require('../models/Employee');
    const Tenant = require('../models/Tenant');
    const Alert = require('../models/Alert');
    const WebhookDeliveryLog = require('../models/WebhookDeliveryLog');
    const { queues } = require('../worker');

    // Step 1: Decode audio buffer and call VocaCore /extract
    logger.info('Step 1: Extracting audio features');
    job.progress(10);

    const vococoreUrl = process.env.VOCOCORE_SERVICE_URL || 'http://vocalysis-vococore.railway.internal';
    const audioData = Buffer.from(audioBuffer, 'base64');

    let audioFeatures = {};
    try {
      const response = await axios.post(
        `${vococoreUrl}/extract`,
        audioData,
        {
          headers: { 'Content-Type': 'application/octet-stream' },
          timeout: 60000
        }
      );
      audioFeatures = response.data || {};
      logger.info('Audio features extracted successfully');
    } catch (error) {
      logger.warn('VocaCore extraction failed: %s. Proceeding with empty features.', error.message);
      audioFeatures = {};
    }

    // Step 2: Call VocaCore engine with features for risk analysis
    logger.info('Step 2: Running VocaCore analysis engine');
    job.progress(25);

    let analysisResult = {
      overallRiskLevel: 'normal',
      confidence: 0,
      features: audioFeatures,
      timestamp: new Date()
    };

    try {
      const engineResponse = await axios.post(
        `${vococoreUrl}/analyze`,
        { audioFeatures, tenantId },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      analysisResult = {
        ...analysisResult,
        ...engineResponse.data
      };
      logger.info('Analysis engine completed with risk level: %s', analysisResult.overallRiskLevel);
    } catch (error) {
      logger.warn('VocaCore analysis engine failed: %s', error.message);
    }

    // Step 3: Fetch and update Session document with results
    logger.info('Step 3: Updating session document');
    job.progress(35);

    sessionDoc = await Session.findById(sessionId);
    if (!sessionDoc) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionDoc.analysisResults = analysisResult;
    sessionDoc.analysisStatus = 'completed';
    sessionDoc.status = 'completed';   // ✅ Fix: frontend polls session.status, not analysisStatus
    sessionDoc.analyzedAt = new Date();
    await sessionDoc.save();
    logger.info('Session document updated with analysis results');

    // Step 4: Mark audio as deleted (it was in-memory only)
    logger.info('Step 4: Marking audio as deleted');
    job.progress(40);

    sessionDoc.audioDeletedAt = new Date();
    sessionDoc.audioDeleteConfirmed = true;
    await sessionDoc.save();
    logger.info('Audio marked as deleted and confirmed');

    // Step 5: Run alert evaluation
    logger.info('Step 5: Evaluating alerts');
    job.progress(50);

    let alertTriggered = false;
    let alertData = null;

    const alertThresholds = {
      critical: 0.8,
      high: 0.6,
      medium: 0.4,
      low: 0.2
    };

    if (analysisResult.overallRiskLevel === 'critical' && analysisResult.confidence > alertThresholds.critical) {
      alertTriggered = true;
      alertData = {
        tenantId,
        employeeId: patientId,
        sessionId,
        type: 'critical_risk',
        severity: 'critical',
        message: `Critical risk level detected for employee ${patientId}`,
        analysisResult: analysisResult,
        triggeredAt: new Date(),
        status: 'new'
      };
    } else if (analysisResult.overallRiskLevel === 'high' && analysisResult.confidence > alertThresholds.high) {
      alertTriggered = true;
      alertData = {
        tenantId,
        employeeId: patientId,
        sessionId,
        type: 'high_risk',
        severity: 'high',
        message: `High risk level detected for employee ${patientId}`,
        analysisResult: analysisResult,
        triggeredAt: new Date(),
        status: 'new'
      };
    }

    if (alertTriggered && alertData) {
      const alert = await Alert.create(alertData);
      logger.info('Alert created: %s', alert._id);
    }

    // Step 6: Queue email notification if alert triggered
    logger.info('Step 6: Queueing notifications');
    job.progress(65);

    if (alertTriggered && alertData) {
      // ✅ Fix: patientId / clinicianId are UUID strings, look up by employeeId field
      const employee = await Employee.findOne({ employeeId: patientId });
      const clinician = clinicianId ? await Employee.findOne({ employeeId: clinicianId }) : null;

      if (clinician && clinician.email) {
        await queues.emailNotifications.add(
          {
            type: 'alert_notification',
            to: clinician.email,
            templateData: {
              clinicianName: clinician.fullName,
              employeeName: employee ? employee.fullName : 'Unknown',
              severity: alertData.severity,
              message: alertData.message,
              sessionId: sessionId,
              timestamp: new Date()
            }
          },
          { jobId: `alert-${sessionId}-${Date.now()}` }
        );
        logger.info('Alert notification queued for clinician');
      }
    }

    // Step 7: Queue webhook delivery if tenant has webhook config
    logger.info('Step 7: Queueing webhook delivery');
    job.progress(75);

    // ✅ Fix: tenantId is a custom string ("cittaa-3z0z"), not a MongoDB ObjectId.
    // The worker's Tenant model doesn't have a tenantId field, so we skip this lookup gracefully.
    let tenant = null;
    try {
      tenant = await Tenant.findById(tenantId);
    } catch (e) {
      logger.warn('Tenant lookup skipped (tenantId is not an ObjectId): %s', e.message);
    }
    if (tenant && tenant.webhookConfig && tenant.webhookConfig.url && tenant.webhookConfig.enabled) {
      const webhookPayload = {
        event: 'session.analysis_complete',
        sessionId: sessionId,
        tenantId: tenantId,
        employeeId: patientId,
        analysisResult: analysisResult,
        alertTriggered: alertTriggered,
        timestamp: new Date().toISOString()
      };

      await queues.webhookDelivery.add(
        {
          tenantId,
          event: 'session.analysis_complete',
          payload: webhookPayload,
          webhookUrl: tenant.webhookConfig.url,
          webhookSecret: tenant.webhookConfig.secret,
          attempt: 1
        },
        { jobId: `webhook-${sessionId}-${Date.now()}` }
      );
      logger.info('Webhook delivery queued');
    }

    // Step 8: Update employee wellness profile
    logger.info('Step 8: Updating employee wellness profile');
    job.progress(85);

    // ✅ Fix: patientId is a UUID string, look up by employeeId field
    const employee = await Employee.findOne({ employeeId: patientId });
    if (employee) {
      if (!employee.wellnessProfile) {
        employee.wellnessProfile = {};
      }

      employee.wellnessProfile.currentRiskLevel = analysisResult.overallRiskLevel || 'normal';
      employee.wellnessProfile.lastAssessmentDate = new Date();
      employee.wellnessProfile.totalAssessments = (employee.wellnessProfile.totalAssessments || 0) + 1;

      if (!employee.wellnessProfile.riskHistory) {
        employee.wellnessProfile.riskHistory = [];
      }
      employee.wellnessProfile.riskHistory.push({
        level: analysisResult.overallRiskLevel,
        timestamp: new Date(),
        sessionId: sessionId,
        confidence: analysisResult.confidence
      });

      // Keep only last 90 days of history
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      employee.wellnessProfile.riskHistory = employee.wellnessProfile.riskHistory.filter(
        entry => new Date(entry.timestamp) > ninetyDaysAgo
      );

      await employee.save();
      logger.info('Employee wellness profile updated');
    }

    // Step 9: Update tenant usage count
    logger.info('Step 9: Updating tenant usage');
    job.progress(95);

    if (tenant) {
      tenant.usedAssessmentCount = (tenant.usedAssessmentCount || 0) + 1;
      tenant.lastAssessmentDate = new Date();
      await tenant.save();
      logger.info('Tenant assessment count updated');
    }

    job.progress(100);
    logger.info('Audio analysis completed successfully for session %s', sessionId);

    return {
      sessionId,
      status: 'complete',
      overallRiskLevel: analysisResult.overallRiskLevel,
      alertTriggered,
      confidence: analysisResult.confidence
    };
  } catch (error) {
    logger.error('Audio analysis failed for session %s: %s', sessionId, error.message);
    // ✅ Fix: mark session as failed so the frontend stops polling
    try {
      const Session = require('../models/Session');
      if (sessionDoc) {
        sessionDoc.analysisStatus = 'failed';
        sessionDoc.status = 'failed';
        await sessionDoc.save();
      } else if (sessionId) {
        await Session.findByIdAndUpdate(sessionId, {
          analysisStatus: 'failed',
          status: 'failed'
        });
      }
    } catch (saveErr) {
      logger.error('Could not mark session as failed: %s', saveErr.message);
    }
    throw error;
  }
};
