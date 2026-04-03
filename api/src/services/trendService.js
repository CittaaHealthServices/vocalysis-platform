/**
 * TrendService — Vocalysis Platform
 *
 * Computes week-over-week acoustic biomarker trends for each employee.
 * Runs after every completed session to:
 *   1. Compare current scores to the employee's rolling 4-week baseline
 *   2. Produce a TrendSnapshot with per-dimension deltas and velocity
 *   3. Raise a pre-alert (deterioration flag) when deterioration is
 *      significant but scores haven't yet crossed hard alert thresholds
 *
 * All analysis is per-employee, per-tenant, and respects existing RBAC.
 */

const Session   = require('../models/Session');
const Alert     = require('../models/Alert');
const logger    = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const BASELINE_WEEKS     = 4;   // rolling window for baseline (weeks)
const MIN_SESSIONS       = 3;   // minimum sessions needed for trend to be meaningful
const DETERIORATION_THRESHOLD = 10;  // points drop triggers pre-alert
const RAPID_THRESHOLD        = 20;  // points drop in a single week = rapid deterioration

// ─── Helper ───────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function trendLabel(delta) {
  if (delta === null || delta === undefined) return 'insufficient_data';
  if (delta <= -RAPID_THRESHOLD)    return 'rapid_deterioration';
  if (delta <= -DETERIORATION_THRESHOLD) return 'deteriorating';
  if (delta < -3)  return 'slight_decline';
  if (delta >  3)  return 'improving';
  return 'stable';
}

function velocityLabel(weekDeltas) {
  if (weekDeltas.length < 2) return 'unknown';
  const recent = weekDeltas.slice(-2);
  if (recent.every(d => d < -5)) return 'accelerating_decline';
  if (recent.every(d => d > 5))  return 'accelerating_improvement';
  return 'steady';
}

// ─── Core: compute trend snapshot for one employee ────────────────────────────

/**
 * computeTrend(employeeId, tenantId, currentSession)
 *
 * Returns a TrendSnapshot:
 * {
 *   baselineAvg:    { depression, anxiety, stress, wellness },
 *   currentScores:  { depression, anxiety, stress, wellness },
 *   deltas:         { depression, anxiety, stress, wellness },   // current - baseline
 *   trendLabels:    { depression, anxiety, stress, overall },
 *   velocity:       'accelerating_decline' | 'steady' | 'accelerating_improvement' | 'unknown',
 *   weeklyHistory:  [ { weekLabel, depression, anxiety, stress, wellness, sessionCount } ],
 *   sessionCount:   number,   // total sessions in the window
 *   preAlert:       boolean,
 *   preAlertDimensions: string[],
 *   preAlertSeverity: 'warning' | 'urgent',
 * }
 */
async function computeTrend(employeeId, tenantId, currentSession) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - BASELINE_WEEKS * 7);

  // Fetch all completed sessions for this employee in the window,
  // excluding the current session (it's already factored in separately)
  const pastSessions = await Session.find({
    $or: [{ employeeId }, { patientId: employeeId }],
    tenantId,
    status: 'completed',
    _id: { $ne: currentSession._id },
    createdAt: { $gte: windowStart },
    'vocacoreResults.dimensionalScores.depression': { $exists: true },
  })
  .sort({ createdAt: 1 })
  .select('createdAt vocacoreResults.dimensionalScores vocacoreResults.riskScore employeeWellnessOutput.wellnessScore')
  .lean();

  const sessionCount = pastSessions.length;

  // Current session scores
  const cur = {
    depression: currentSession.vocacoreResults?.dimensionalScores?.depression ?? null,
    anxiety:    currentSession.vocacoreResults?.dimensionalScores?.anxiety    ?? null,
    stress:     currentSession.vocacoreResults?.dimensionalScores?.stress     ?? null,
    wellness:   currentSession.employeeWellnessOutput?.wellnessScore          ?? null,
  };

  if (sessionCount < MIN_SESSIONS) {
    // Not enough history — still return current scores, mark as insufficient
    return {
      baselineAvg:         null,
      currentScores:       cur,
      deltas:              null,
      trendLabels:         { depression: 'insufficient_data', anxiety: 'insufficient_data', stress: 'insufficient_data', overall: 'insufficient_data' },
      velocity:            'unknown',
      weeklyHistory:       _buildWeeklyHistory(pastSessions, cur, currentSession.createdAt),
      sessionCount,
      preAlert:            false,
      preAlertDimensions:  [],
      preAlertSeverity:    null,
    };
  }

  // Compute rolling baseline from past sessions
  const baselineAvg = {
    depression: avg(pastSessions.map(s => s.vocacoreResults?.dimensionalScores?.depression).filter(v => v != null)),
    anxiety:    avg(pastSessions.map(s => s.vocacoreResults?.dimensionalScores?.anxiety).filter(v => v != null)),
    stress:     avg(pastSessions.map(s => s.vocacoreResults?.dimensionalScores?.stress).filter(v => v != null)),
    wellness:   avg(pastSessions.map(s => s.employeeWellnessOutput?.wellnessScore).filter(v => v != null)),
  };

  // Deltas: positive = current HIGHER than baseline (for depression/anxiety/stress, higher = worse; for wellness, higher = better)
  const deltas = {
    depression: cur.depression !== null && baselineAvg.depression !== null ? +(cur.depression - baselineAvg.depression).toFixed(1) : null,
    anxiety:    cur.anxiety    !== null && baselineAvg.anxiety    !== null ? +(cur.anxiety    - baselineAvg.anxiety   ).toFixed(1) : null,
    stress:     cur.stress     !== null && baselineAvg.stress     !== null ? +(cur.stress     - baselineAvg.stress    ).toFixed(1) : null,
    wellness:   cur.wellness   !== null && baselineAvg.wellness   !== null ? +(cur.wellness   - baselineAvg.wellness  ).toFixed(1) : null,
  };

  // Trend labels — for distress dimensions: positive delta = deteriorating
  const trendLabels = {
    depression: trendLabel(deltas.depression),
    anxiety:    trendLabel(deltas.anxiety),
    stress:     trendLabel(deltas.stress),
    // For wellness score: flip sign (increase = improving)
    wellness:   trendLabel(deltas.wellness !== null ? -deltas.wellness : null),
  };

  // Overall trend = worst of the three distress dimensions
  const overallWorst = [trendLabels.depression, trendLabels.anxiety, trendLabels.stress];
  const SEVERITY_RANK = { rapid_deterioration: 4, deteriorating: 3, slight_decline: 2, stable: 1, improving: 0, insufficient_data: -1 };
  trendLabels.overall = overallWorst.sort((a, b) => (SEVERITY_RANK[b] ?? 0) - (SEVERITY_RANK[a] ?? 0))[0];

  // Build weekly history for sparkline charts
  const weeklyHistory = _buildWeeklyHistory(pastSessions, cur, currentSession.createdAt);

  // Velocity — check last-2-week deltas in the weekly history
  const recentWeekDeltas = weeklyHistory.slice(-2).map(w => w.depression ?? 0);
  const velocity = velocityLabel(recentWeekDeltas);

  // Pre-alert detection — deteriorating significantly but not yet at hard threshold
  const preAlertDimensions = [];
  const HARD_THRESHOLDS = { depression: 70, anxiety: 65, stress: 75 };

  for (const dim of ['depression', 'anxiety', 'stress']) {
    const score = cur[dim];
    const delta = deltas[dim];
    const threshold = HARD_THRESHOLDS[dim];
    if (score === null || delta === null) continue;
    // Pre-alert: score is below hard threshold BUT deteriorating significantly
    if (score < threshold && delta >= DETERIORATION_THRESHOLD) {
      preAlertDimensions.push(dim);
    }
  }

  const preAlert = preAlertDimensions.length > 0;
  const hasRapid = preAlertDimensions.some(dim => (deltas[dim] ?? 0) >= RAPID_THRESHOLD);
  const preAlertSeverity = preAlert ? (hasRapid ? 'urgent' : 'warning') : null;

  return {
    baselineAvg:        { depression: +baselineAvg.depression.toFixed(1), anxiety: +baselineAvg.anxiety.toFixed(1), stress: +baselineAvg.stress.toFixed(1), wellness: baselineAvg.wellness != null ? +baselineAvg.wellness.toFixed(1) : null },
    currentScores:      cur,
    deltas,
    trendLabels,
    velocity,
    weeklyHistory,
    sessionCount: sessionCount + 1,  // include current
    preAlert,
    preAlertDimensions,
    preAlertSeverity,
  };
}

// ─── Build 4-week weekly history ──────────────────────────────────────────────

function _buildWeeklyHistory(pastSessions, currentScores, currentDate) {
  const weeks = [];
  const now = currentDate ? new Date(currentDate) : new Date();

  for (let w = BASELINE_WEEKS - 1; w >= 0; w--) {
    const weekEnd   = new Date(now.getTime() - w       * 7 * 86400000);
    const weekStart = new Date(now.getTime() - (w + 1) * 7 * 86400000);

    const weekSessions = pastSessions.filter(s => {
      const d = new Date(s.createdAt);
      return d >= weekStart && d < weekEnd;
    });

    const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w + 1}w ago`;

    if (weekSessions.length === 0) {
      weeks.push({ weekLabel: label, depression: null, anxiety: null, stress: null, wellness: null, sessionCount: 0 });
    } else {
      weeks.push({
        weekLabel:    label,
        depression:   +avg(weekSessions.map(s => s.vocacoreResults?.dimensionalScores?.depression).filter(v => v != null)).toFixed(1),
        anxiety:      +avg(weekSessions.map(s => s.vocacoreResults?.dimensionalScores?.anxiety).filter(v => v != null)).toFixed(1),
        stress:       +avg(weekSessions.map(s => s.vocacoreResults?.dimensionalScores?.stress).filter(v => v != null)).toFixed(1),
        wellness:     +avg(weekSessions.map(s => s.employeeWellnessOutput?.wellnessScore).filter(v => v != null)).toFixed(1),
        sessionCount: weekSessions.length,
      });
    }
  }

  // Add current week's current session
  const currentWeek = weeks[weeks.length - 1];
  if (currentWeek && currentScores.depression !== null) {
    currentWeek.weekLabel    = 'This week';
    currentWeek.depression   = currentScores.depression;
    currentWeek.anxiety      = currentScores.anxiety;
    currentWeek.stress       = currentScores.stress;
    currentWeek.wellness     = currentScores.wellness;
    currentWeek.sessionCount = (currentWeek.sessionCount || 0) + 1;
  }

  return weeks;
}

// ─── Create pre-alert in the Alert collection ─────────────────────────────────

/**
 * maybeCreatePreAlert
 *
 * Creates a 'pre_alert' level alert (lower than 'high') so HR/clinicians
 * can see deterioration trends before they become clinical emergencies.
 */
async function maybeCreatePreAlert(session, trend) {
  if (!trend.preAlert) return null;

  try {
    // Avoid duplicate pre-alerts for the same employee in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const existing = await Alert.findOne({
      $or: [{ employeeId: session.employeeId }, { employeeId: session.patientId }],
      tenantId: session.tenantId,
      alertLevel: 'pre_alert',
      createdAt: { $gte: sevenDaysAgo },
    });
    if (existing) return null;

    const dimensionSummary = trend.preAlertDimensions
      .map(d => `${d.charAt(0).toUpperCase() + d.slice(1)}: +${trend.deltas[d]} pts above baseline`)
      .join(', ');

    const alert = await Alert.create({
      tenantId:        session.tenantId,
      employeeId:      session.employeeId || session.patientId,
      sessionId:       session._id,
      alertLevel:      'pre_alert',
      status:          'new',
      triggeringScores: trend.preAlertDimensions.map(d => `${d}: ${trend.currentScores[d]} (baseline ${trend.baselineAvg?.[d]}, Δ+${trend.deltas[d]})`),
      message:         `Deterioration trend detected. ${dimensionSummary}. Velocity: ${trend.velocity}. No immediate clinical threshold breached.`,
      trendSnapshot:   {
        preAlertSeverity:   trend.preAlertSeverity,
        preAlertDimensions: trend.preAlertDimensions,
        velocity:           trend.velocity,
        deltas:             trend.deltas,
      },
    });

    logger.info('Pre-alert created for trend deterioration', {
      alertId: alert._id,
      employeeId: session.employeeId || session.patientId,
      tenantId: session.tenantId,
      dimensions: trend.preAlertDimensions,
    });

    return alert;
  } catch (err) {
    logger.error('Failed to create pre-alert', { error: err.message });
    return null;
  }
}

// ─── Employee trend API helper ────────────────────────────────────────────────

/**
 * getEmployeeTrendHistory(employeeId, tenantId, weeks)
 *
 * Returns the last N weeks of session data for charting on the employee
 * history page and HR analytics.
 */
async function getEmployeeTrendHistory(employeeId, tenantId, weeks = 12) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - weeks * 7);

  const sessions = await Session.find({
    $or: [{ employeeId }, { patientId: employeeId }],
    tenantId,
    status: 'completed',
    createdAt: { $gte: windowStart },
    'vocacoreResults.dimensionalScores.depression': { $exists: true },
  })
  .sort({ createdAt: 1 })
  .select('createdAt vocacoreResults.dimensionalScores vocacoreResults.overallRiskLevel vocacoreResults.standardScales employeeWellnessOutput.wellnessScore trendData')
  .lean();

  // Build data points for chart rendering
  const dataPoints = sessions.map(s => ({
    date:       s.createdAt,
    depression: s.vocacoreResults?.dimensionalScores?.depression ?? null,
    anxiety:    s.vocacoreResults?.dimensionalScores?.anxiety    ?? null,
    stress:     s.vocacoreResults?.dimensionalScores?.stress     ?? null,
    wellness:   s.employeeWellnessOutput?.wellnessScore          ?? null,
    riskLevel:  s.vocacoreResults?.overallRiskLevel              ?? null,
    phq9:       s.vocacoreResults?.standardScales?.phq9?.score   ?? null,
    gad7:       s.vocacoreResults?.standardScales?.gad7?.score   ?? null,
    trendLabel: s.trendData?.overall ?? null,
  }));

  // 4-week rolling average for each data point
  const withRolling = dataPoints.map((pt, idx) => {
    const windowPts = dataPoints.slice(Math.max(0, idx - 3), idx + 1);
    return {
      ...pt,
      rollingAvgWellness: +avg(windowPts.map(p => p.wellness).filter(v => v != null)).toFixed(1),
    };
  });

  // Summary stats
  const allWellness  = withRolling.map(p => p.wellness).filter(v => v != null);
  const allDep       = withRolling.map(p => p.depression).filter(v => v != null);
  const firstScore   = allWellness[0] ?? null;
  const lastScore    = allWellness[allWellness.length - 1] ?? null;
  const overallDelta = firstScore !== null && lastScore !== null ? +(lastScore - firstScore).toFixed(1) : null;

  return {
    dataPoints: withRolling,
    summary: {
      totalSessions:    sessions.length,
      avgWellness:      allWellness.length ? +avg(allWellness).toFixed(1) : null,
      avgDepression:    allDep.length      ? +avg(allDep).toFixed(1)      : null,
      overallDelta,
      overallTrend:     overallDelta === null ? 'insufficient_data'
                        : overallDelta > 5 ? 'improving'
                        : overallDelta < -5 ? 'deteriorating'
                        : 'stable',
    },
  };
}

module.exports = { computeTrend, maybeCreatePreAlert, getEmployeeTrendHistory };
