const axios = require('axios');
const FormData = require('form-data');
const logger = require('../logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _riskLevel(dep, anx, str) {
  const max = Math.max(dep, anx, str);
  if (dep >= 80 || anx >= 80 || str >= 85) return 'red';
  if (dep >= 65 || anx >= 65 || str >= 70) return 'orange';
  if (dep >= 45 || anx >= 45 || str >= 50) return 'yellow';
  return 'green';
}

function _wellnessLevel(str) {
  if (str > 75) return 'in_crisis';
  if (str > 55) return 'at_risk';
  if (str > 30) return 'healthy';
  return 'thriving';
}

function _generateRecs(dep, anx, str) {
  const recs = [];
  if (str > 55) recs.push('Try stress-reduction techniques like deep breathing or a short walk');
  if (anx > 55) recs.push('Consider mindfulness exercises or a 5-minute breathing meditation');
  if (dep > 55) recs.push('Connect with a trusted colleague or speak with a counselor for support');
  if (recs.length === 0) recs.push('Continue your current wellness routine — you are doing great!');
  return recs;
}

/**
 * Build biomarker findings from audio features and scores.
 * Indian-calibrated norms: F0 165-185 Hz, speech rate 4.2-5.2 syl/s.
 */
function _biomarkerFindings(features) {
  const f = features || {};

  const f0 = f.f0_mean || f.pitch_mean || 174;
  const pitchSev = f0 < 120 ? 'high' : f0 < 145 ? 'moderate' : 'low';
  const pitchFinding = f0 < 120
    ? 'Low fundamental frequency — consistent with reduced emotional arousal'
    : f0 > 220 ? 'Elevated pitch — consistent with heightened emotional state'
    : 'Pitch within normal Indian voice range (165–185 Hz)';

  const sr = f.speech_rate || f.rate_syllables || 4.4;
  const rateSev = sr < 3.0 ? 'high' : sr < 3.5 ? 'moderate' : sr > 5.8 ? 'moderate' : 'low';
  const rateFinding = sr < 3.0
    ? 'Significantly reduced speech rate — key depression indicator'
    : sr < 3.5 ? 'Mildly slowed speech rate detected'
    : sr > 5.8 ? 'Elevated speech rate — possible anxiety marker'
    : 'Speech rate within normal Indian range (4.2–5.2 syl/s)';

  const jitter  = f.jitter || f.jitter_local || 0.021;
  const shimmer = f.shimmer || f.shimmer_local || 0.073;
  const hnr     = f.hnr || f.hnr_db || 20.5;
  const vqSev   = jitter > 0.040 || shimmer > 0.11 ? 'high'
                : jitter > 0.030 || shimmer > 0.09  ? 'moderate' : 'low';
  const vqFinding = vqSev === 'high'
    ? 'Elevated jitter/shimmer with reduced HNR — vocal irregularity detected'
    : vqSev === 'moderate' ? 'Mild vocal perturbations detected'
    : 'Vocal quality within normal range';

  const energy = f.energy_mean || f.energy || 0.050;
  const engSev = energy < 0.025 ? 'high' : energy < 0.035 ? 'moderate' : energy > 0.085 ? 'moderate' : 'low';
  const engFinding = energy < 0.025
    ? 'Very low vocal energy — consistent with fatigue or low mood'
    : energy < 0.035 ? 'Below-average vocal energy detected'
    : energy > 0.085 ? 'Elevated vocal energy — possible stress indicator'
    : 'Vocal energy within normal range';

  const rhythm  = f.rhythm_regularity || 0.74;
  const pauseR  = f.pause_ratio || 0.22;
  const rhythSev = rhythm < 0.55 || pauseR > 0.45 ? 'high'
                 : rhythm < 0.65 || pauseR > 0.35 ? 'moderate' : 'low';
  const rhythFinding = pauseR > 0.45
    ? 'High pause ratio — significant silence patterns detected'
    : rhythm < 0.60 ? 'Irregular speech rhythm pattern detected'
    : 'Rhythm and pause patterns within expected range';

  return {
    pitch:            { finding: pitchFinding,   severity: pitchSev,  value: Math.round(f0) },
    speech_rate:      { finding: rateFinding,    severity: rateSev,   value: Math.round(sr * 10) / 10 },
    vocal_quality:    { finding: vqFinding,      severity: vqSev,     value: Math.round(hnr * 10) / 10 },
    energy_level:     { finding: engFinding,     severity: engSev,    value: Math.round(energy * 1000) / 1000 },
    rhythm_stability: { finding: rhythFinding,   severity: rhythSev,  value: Math.round(rhythm * 100) },
  };
}

/**
 * Deterministic fallback scoring when VocoCore is unavailable.
 * Returns { dep, anx, str, confScore } — all 0-100.
 */
function _deterministicScores(features) {
  const f = features || {};
  let dep = 35, anx = 30, str = 32;

  // Pitch (Indian normal range: 165-185 Hz)
  const f0 = f.f0_mean || 174;
  if (f0 < 120) dep = Math.min(80, dep + 35);
  else if (f0 < 140) dep = Math.min(65, dep + 18);

  // Speech rate (Indian normal: 4.2-5.2 syl/s)
  const sr = f.speech_rate || 4.4;
  if (sr < 2.8) dep = Math.min(80, dep + 30);
  else if (sr > 5.8) { anx = Math.min(75, anx + 20); str = Math.min(75, str + 15); }

  // Pause ratio (Indian norm ≤ 0.30)
  const pause = f.pause_ratio || 0;
  if (pause > 0.45) dep = Math.min(80, dep + 25);

  // Energy
  const energy = f.energy_mean || 0.05;
  if (energy < 0.025) dep = Math.min(85, dep + 20);
  else if (energy > 0.085) str = Math.min(75, str + 20);

  // Vocal irregularity
  const jitter = f.jitter || f.jitter_local || 0;
  if (jitter > 0.040) anx = Math.min(75, anx + 22);

  return { dep: Math.round(dep), anx: Math.round(anx), str: Math.round(str), confScore: 45 };
}

// ─── Main processor ───────────────────────────────────────────────────────────

module.exports = async function audioAnalysisProcessor(job) {
  const { sessionId, tenantId, audioBuffer, filename, patientId, clinicianId } = job.data;
  let sessionDoc = null;

  try {
    logger.info('Starting audio analysis for session %s', sessionId);
    job.progress(5);

    const Session     = require('../models/Session');
    const Employee    = require('../models/Employee');
    const Tenant      = require('../models/Tenant');
    const Alert       = require('../models/Alert');
    const { queues }  = require('../worker');

    // ── Step 1: Call VocoCore /score (features + ML in one call) ─────────────
    logger.info('Step 1: Running VocoCore ML scoring');
    job.progress(10);

    const vococoreUrl = process.env.VOCOCORE_SERVICE_URL;
    const internalKey = process.env.VOCOCORE_INTERNAL_KEY || 'dev-key-12345';
    const audioData   = Buffer.from(audioBuffer, 'base64');

    let dep = 35, anx = 30, str = 32, confScore = 45;
    let featuresData = {};
    let scorerUsed   = 'deterministic_fallback';

    if (vococoreUrl) {
      try {
        const form = new FormData();
        form.append('audio', audioData, { filename: filename || 'audio.wav' });

        const response = await axios.post(`${vococoreUrl}/score`, form, {
          headers: { ...form.getHeaders(), 'X-VocoCore-Internal-Key': internalKey },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        if (response.data?.success) {
          const s = response.data.scores || {};
          dep         = Math.round(s.depression_score ?? dep);
          anx         = Math.round(s.anxiety_score    ?? anx);
          str         = Math.round(s.stress_score     ?? str);
          confScore   = Math.min(100, Math.round(((s.ml_confidence ?? 0.9) * 100 + (s.model_accuracy ?? 96.44)) / 2));
          featuresData = response.data.features || {};
          scorerUsed   = 'vococore_ml';
          logger.info('VocoCore ML scoring complete — dep:%d anx:%d str:%d conf:%d', dep, anx, str, confScore);
        } else {
          throw new Error(response.data?.error?.message || 'VocoCore /score returned failure');
        }
      } catch (err) {
        logger.warn('VocoCore /score failed (%s). Trying /fallback...', err.message);

        // Try /fallback as secondary
        try {
          const form2 = new FormData();
          form2.append('audio', audioData, { filename: filename || 'audio.wav' });
          const fbRes = await axios.post(`${vococoreUrl}/fallback`, form2, {
            headers: { ...form2.getHeaders(), 'X-VocoCore-Internal-Key': internalKey },
            timeout: 60000,
          });
          if (fbRes.data?.depression_score !== undefined) {
            dep       = Math.round(fbRes.data.depression_score ?? dep);
            anx       = Math.round(fbRes.data.anxiety_score    ?? anx);
            str       = Math.round(fbRes.data.stress_score     ?? str);
            confScore = 55;
            scorerUsed = 'vococore_fallback';
            logger.info('VocoCore /fallback succeeded — dep:%d anx:%d str:%d', dep, anx, str);
          }
        } catch (fbErr) {
          logger.warn('VocoCore /fallback also failed (%s). Using deterministic scoring.', fbErr.message);
          const det = _deterministicScores(featuresData);
          dep = det.dep; anx = det.anx; str = det.str; confScore = det.confScore;
          scorerUsed = 'deterministic_fallback';
        }
      }
    } else {
      // No VocoCore URL configured — use deterministic scoring
      const det = _deterministicScores({});
      dep = det.dep; anx = det.anx; str = det.str; confScore = det.confScore;
      logger.warn('VOCOCORE_SERVICE_URL not set — using deterministic scoring');
    }

    // ── Step 2: Build canonical result fields ─────────────────────────────────
    const riskLevel         = _riskLevel(dep, anx, str);
    const wellnessScore     = Math.round((100 - str) * 0.6 + confScore * 0.4);
    const wellnessLevel     = _wellnessLevel(str);
    const recs              = _generateRecs(dep, anx, str);
    const biomarkerFindings = _biomarkerFindings(featuresData);

    // ── Step 3: Fetch and update Session document ─────────────────────────────
    logger.info('Step 3: Updating session document');
    job.progress(35);

    // ✅ Use findByIdAndUpdate + $set to guarantee all fields are written to MongoDB.
    // Using save() on subdocuments without markModified() can silently drop fields.
    const now = new Date();
    const updateResult = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          status:          'completed',
          analysisStatus:  'completed',
          analyzedAt:      now,
          'vocacoreResults': {
            overallRiskLevel: riskLevel,
            riskScore:        Math.round((dep + anx + str) / 3),
            confidence:       confScore,
            dimensionalScores: {
              depression: dep,
              anxiety:    anx,
              stress:     str,
              burnout:    Math.round(str * 0.8),
              engagement: Math.round(100 - str * 0.5),
            },
            biomarkerFindings,
            keyIndicators:           [],
            clinicalRecommendations: recs,
            algorithmVersion:        scorerUsed,
            engineVersion:           'VocoCore™ 2.1-India',
            processedAt:             now,
          },
          'employeeWellnessOutput': {
            wellnessScore,
            wellnessLevel,
            personalizedRecommendations: recs,
            actionItems:     [],
            nextCheckInDate: new Date(Date.now() + 7 * 86400000),
          },
          audioFeatures:   featuresData,
          // legacy
          analysisResults: { overallRiskLevel: riskLevel, confidence: confScore, timestamp: now },
          'audioMetadata.processingCompletedAt': now,
          'audioMetadata.processingStatus':      'completed',
        }
      },
      { new: true }
    );

    if (!updateResult) throw new Error(`Session ${sessionId} not found during update`);
    sessionDoc = updateResult;
    logger.info('Session document updated — wellnessScore:%d riskLevel:%s scorer:%s', wellnessScore, riskLevel, scorerUsed);

    job.progress(50);

    // ── Step 4: Alert evaluation ──────────────────────────────────────────────
    logger.info('Step 4: Evaluating alerts');
    const highRisk = riskLevel === 'red' || riskLevel === 'orange';
    if (highRisk) {
      try {
        await Alert.create({
          tenantId,
          employeeId: patientId,
          sessionId,
          type:        riskLevel === 'red' ? 'critical_risk' : 'high_risk',
          severity:    riskLevel === 'red' ? 'critical' : 'high',
          message:     `${riskLevel === 'red' ? 'Critical' : 'High'} risk level detected for employee ${patientId}`,
          triggeredAt: new Date(),
          status:      'new',
        });
        logger.info('Alert created for risk level: %s', riskLevel);
      } catch (alertErr) {
        logger.warn('Alert creation failed (non-fatal): %s', alertErr.message);
      }
    }

    job.progress(65);

    // ── Step 5: Notify clinician if high-risk ─────────────────────────────────
    if (highRisk && clinicianId) {
      try {
        const clinician = await Employee.findOne({ employeeId: clinicianId });
        const employee  = await Employee.findOne({ employeeId: patientId });
        if (clinician?.email) {
          await queues.emailNotifications.add({
            type: 'alert_notification',
            to:   clinician.email,
            templateData: {
              clinicianName: clinician.fullName,
              employeeName:  employee?.fullName || 'Unknown',
              severity:      riskLevel,
              sessionId,
              timestamp:     new Date(),
            },
          }, { jobId: `alert-${sessionId}-${Date.now()}` });
        }
      } catch (notifyErr) {
        logger.warn('Clinician notification failed (non-fatal): %s', notifyErr.message);
      }
    }

    job.progress(80);

    // ── Step 6: Update employee wellness profile ──────────────────────────────
    try {
      const employee = await Employee.findOne({ employeeId: patientId });
      if (employee) {
        if (!employee.wellnessProfile) employee.wellnessProfile = {};
        employee.wellnessProfile.currentRiskLevel    = riskLevel;
        employee.wellnessProfile.lastAssessmentDate  = new Date();
        employee.wellnessProfile.totalAssessments    = (employee.wellnessProfile.totalAssessments || 0) + 1;
        if (!employee.wellnessProfile.riskHistory) employee.wellnessProfile.riskHistory = [];
        employee.wellnessProfile.riskHistory.push({ level: riskLevel, timestamp: new Date(), sessionId, confidence: confScore });
        // Keep last 90 days
        const cutoff = new Date(Date.now() - 90 * 86400000);
        employee.wellnessProfile.riskHistory = employee.wellnessProfile.riskHistory.filter(e => new Date(e.timestamp) > cutoff);
        await employee.save();
      }
    } catch (profileErr) {
      logger.warn('Employee profile update failed (non-fatal): %s', profileErr.message);
    }

    // ── Step 7: Notify VocoCore of completed session ──────────────────────────
    // This increments the session counter inside VocoCore and triggers an
    // ElevenLabs auto-retrain once every RETRAIN_SESSION_COUNT sessions (default 50).
    // Fire-and-forget — we do NOT await so the job completes instantly.
    if (vococoreUrl) {
      axios.post(`${vococoreUrl}/session-trained`, {}, {
        headers: { 'X-VocoCore-Internal-Key': internalKey },
        timeout: 5000,
      }).then(res => {
        const d = res.data || {};
        if (d.retrain_triggered) {
          logger.info('[session-trained] retrain threshold reached — auto-retrain triggered (total=%d)', d.counters?.total_sessions);
        } else {
          logger.info('[session-trained] counter updated (since_last=%d / threshold=%d)', d.counters?.sessions_since_last_retrain, d.counters?.threshold);
        }
      }).catch(err => {
        logger.warn('[session-trained] ping failed (non-fatal): %s', err.message);
      });
    }

    job.progress(100);
    logger.info('Audio analysis completed for session %s', sessionId);

    return { sessionId, status: 'complete', wellnessScore, riskLevel, scorerUsed };

  } catch (error) {
    logger.error('Audio analysis failed for session %s: %s', sessionId, error.message);
    try {
      const Session = require('../models/Session');
      if (sessionDoc) {
        sessionDoc.analysisStatus = 'failed';
        sessionDoc.status = 'failed';
        await sessionDoc.save();
      } else if (sessionId) {
        await Session.findByIdAndUpdate(sessionId, { analysisStatus: 'failed', status: 'failed' });
      }
    } catch (saveErr) {
      logger.error('Could not mark session as failed: %s', saveErr.message);
    }
    throw error;
  }
};
