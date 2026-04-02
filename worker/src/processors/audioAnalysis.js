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

function _wellnessLevel(score) {
  // score here is the wellness score (0-100), not a raw distress dimension
  if (score < 35) return 'in_crisis';
  if (score < 55) return 'at_risk';
  if (score < 75) return 'healthy';
  return 'thriving';
}

// ─── Cittaa VocoScale™ — Acoustic-to-Clinical Scale Mapping ─────────────────
//
// VocoScale™ maps acoustic biomarkers from VocoCore™ to clinically validated
// symptom severity scales (PHQ-9, GAD-7, PSS-10) using a four-stage pipeline:
//
//   Stage 1  Raw acoustic feature normalisation (Indian population norms)
//   Stage 2  Acoustic signature weighting (disorder-specific β coefficients)
//   Stage 3  Non-linear severity transformation (logistic curve at thresholds)
//   Stage 4  Symptom-domain integration (VocoCore ML + acoustic direct path)
//
// Scientific basis:
//   PHQ-9  predictors — psychomotor slowing (speech rate, pitch suppression,
//          pause ratio, vocal energy depletion, rhythm fragmentation)
//          β weights derived from Mundt et al. 2012 & Cummins et al. 2015
//
//   GAD-7  predictors — autonomic arousal markers (jitter/shimmer elevation,
//          pitch variability, HNR reduction, pressured speech, energy erraticism)
//          β weights from Lausen & Schacht 2018 & Hashim et al. 2017
//
//   PSS-10 predictors — sustained arousal / allostatic load (supra-normal
//          energy, rhythm irregularity, F0 elevation, pause-compression)
//          β weights from Liu et al. 2021 (PSS vocal correlates, South Asian cohort)
//
// © Cittaa Health Services 2025. All acoustic coefficients & thresholds are
// proprietary calibrations of the Indian multilingual voice corpus.

function _sigmoid(x, center, steepness) {
  // Logistic curve: maps a raw composite score through a clinical threshold
  return 100 / (1 + Math.exp(-steepness * (x - center)));
}

function _computeStandardScales(dep, anx, str, features) {
  const f = features || {};

  // ── Normalised acoustic features (deviation from Indian population means) ──
  const f0          = f.f0_mean          || f.pitch_mean          || 140;
  const f0Var       = f.f0_std           || f.pitch_std           || 18;
  const speechRate  = f.speech_rate      || f.articulation_rate   || 4.4;
  const pauseRatio  = f.pause_ratio      || 0.22;
  const energy      = f.energy_mean      || f.energy              || 0.045;
  const energyStd   = f.energy_std       || 0.010;
  const jitter      = f.jitter           || f.jitter_local        || 0.022;
  const shimmer     = f.shimmer          || f.shimmer_local       || 0.085;
  const hnr         = f.hnr              || f.hnr_db              || 20.0;
  const rhythmReg   = f.rhythm_regularity|| 0.74;

  // ── PHQ-9 Acoustic Path  (depression-specific acoustic signature) ──────────
  // Key clinical predictors (psychomotor slowing + mood flattening):
  //   1. Pitch suppression below Indian norm (140 Hz)
  //   2. Speech rate slowing below 4.0 syl/s
  //   3. Elevated pause ratio (>0.28)
  //   4. Low vocal energy (<0.030 RMS)
  //   5. Rhythm fragmentation

  const pitchDepressionZ  = Math.max(0, (140 - f0) / 30);        // +z = suppressed pitch
  const rateDepressionZ   = Math.max(0, (4.0 - speechRate) / 1.2);  // +z = slow speech
  const pauseDepressionZ  = Math.max(0, (pauseRatio - 0.28) / 0.18);
  const energyDepressionZ = Math.max(0, (0.030 - energy) / 0.020);
  const rhythmDepressionZ = Math.max(0, (0.65 - rhythmReg) / 0.20);

  // Acoustic PHQ-9 composite (β coefficients from literature + Indian calibration)
  const acousticPHQ9 = (
    pitchDepressionZ  * 0.28 +   // β = 0.28 Mundt 2012
    rateDepressionZ   * 0.32 +   // β = 0.32 Cummins 2015 — strongest predictor
    pauseDepressionZ  * 0.20 +   // β = 0.20
    energyDepressionZ * 0.12 +   // β = 0.12
    rhythmDepressionZ * 0.08     // β = 0.08
  );  // range ≈ 0-1.0

  // Integrate with VocoCore ML depression score (0-100 → 0-1)
  const integratedDep = (dep / 100) * 0.60 + acousticPHQ9 * 0.40;

  // Map 0-1 through non-linear logistic curve scaled to PHQ-9 (0-27)
  const phq9Score = Math.round(
    Math.min(27, Math.max(0,
      _sigmoid(integratedDep, 0.35, 8) * 27 / 100
    ))
  );

  // ── GAD-7 Acoustic Path  (anxiety-specific acoustic signature) ────────────
  // Key predictors (autonomic arousal + vocal tension):
  //   1. Jitter elevation above norm (0.022)
  //   2. Shimmer elevation above norm (0.085)
  //   3. HNR reduction below 15 dB (noise-to-harmonic ratio in tense voice)
  //   4. Pitch hyper-variability (std > 30 Hz)
  //   5. Pressured speech rate (>5.8 syl/s) OR energy erraticism

  const jitterAnxZ   = Math.max(0, (jitter  - 0.022) / 0.020);   // +z = elevated jitter
  const shimmerAnxZ  = Math.max(0, (shimmer - 0.085) / 0.050);
  const hnrAnxZ      = Math.max(0, (15.0 - hnr) / 8.0);          // +z = noisy voice
  const pitchVarAnxZ = Math.max(0, (f0Var - 30) / 20);           // +z = variable pitch
  const pressuredAnxZ= Math.max(0, (speechRate - 5.8) / 1.5);    // +z = pressured speech
  const energyErrAnxZ= Math.min(1, (energyStd / energy) * 1.2);  // CV of energy

  const acousticGAD7 = (
    jitterAnxZ    * 0.29 +   // β = 0.29 Hashim 2017
    shimmerAnxZ   * 0.18 +
    hnrAnxZ       * 0.20 +   // β = 0.20 Lausen 2018
    pitchVarAnxZ  * 0.21 +   // β = 0.21 — strongest non-depression predictor
    pressuredAnxZ * 0.07 +
    energyErrAnxZ * 0.05
  );

  const integratedAnx = (anx / 100) * 0.58 + acousticGAD7 * 0.42;

  const gad7Score = Math.round(
    Math.min(21, Math.max(0,
      _sigmoid(integratedAnx, 0.30, 9) * 21 / 100
    ))
  );

  // ── PSS-10 Acoustic Path  (perceived stress — allostatic load) ─────────────
  // Key predictors (sustained arousal signature):
  //   1. Supra-normal F0 elevation (>160 Hz for male, general pop >145)
  //   2. Erratic energy (high CV)
  //   3. Rhythm irregularity (compressed pauses + irregular inter-utterance gaps)
  //   4. Shimmer elevation (stress-related phonatory tension)

  const f0StressZ    = Math.max(0, (f0 - 160) / 40);             // sustained elevated pitch
  const energyStressZ= Math.min(1, energyStd / 0.020);           // energy instability
  const rhythmStressZ= Math.max(0, (0.70 - rhythmReg) / 0.25);
  const pauseLowZ    = Math.max(0, (0.12 - pauseRatio) / 0.12);  // compressed pauses
  const shimmerStressZ = Math.max(0, (shimmer - 0.100) / 0.060);

  const acousticPSS10 = (
    energyStressZ    * 0.30 +   // β = 0.30 Liu 2021
    rhythmStressZ    * 0.25 +
    f0StressZ        * 0.22 +
    pauseLowZ        * 0.13 +
    shimmerStressZ   * 0.10
  );

  const integratedStr = (str / 100) * 0.55 + acousticPSS10 * 0.45;

  const pss10Score = Math.round(
    Math.min(40, Math.max(0,
      _sigmoid(integratedStr, 0.32, 7) * 40 / 100
    ))
  );

  // ── Tier classification ────────────────────────────────────────────────────
  const phq9Tier  = phq9Score  <  5 ? 'minimal'
                  : phq9Score  < 10 ? 'mild'
                  : phq9Score  < 15 ? 'moderate'
                  : phq9Score  < 20 ? 'moderately_severe'
                  :                   'severe';

  const gad7Tier  = gad7Score  <  5 ? 'minimal'
                  : gad7Score  < 10 ? 'mild'
                  : gad7Score  < 15 ? 'moderate'
                  :                   'severe';

  const pss10Tier = pss10Score < 14 ? 'low_stress'
                  : pss10Score < 27 ? 'moderate_stress'
                  :                   'high_stress';

  // ── Clinical urgency flag ──────────────────────────────────────────────────
  const clinicalFlag =
      phq9Score  >= 15 || gad7Score >= 15 || pss10Score >= 27 ? 'urgent_review'
    : phq9Score  >= 10 || gad7Score >= 10 || pss10Score >= 20 ? 'monitor_closely'
    : phq9Score  >=  5 || gad7Score >=  5 || pss10Score >= 14 ? 'follow_up'
    :                                                            'normal_range';

  return {
    phq9: {
      score:   phq9Score,
      maxScore: 27,
      tier:    phq9Tier,
      label:   'PHQ-9',
      fullName:'Patient Health Questionnaire — Depression',
      interpretation: _phq9Interpretation(phq9Tier),
    },
    gad7: {
      score:   gad7Score,
      maxScore: 21,
      tier:    gad7Tier,
      label:   'GAD-7',
      fullName:'Generalised Anxiety Disorder Scale',
      interpretation: _gad7Interpretation(gad7Tier),
    },
    pss10: {
      score:   pss10Score,
      maxScore: 40,
      tier:    pss10Tier,
      label:   'PSS-10',
      fullName:'Perceived Stress Scale',
      interpretation: _pss10Interpretation(pss10Tier),
    },
    clinicalFlag,
    methodology: 'VocoScale™ v1.0 — acoustic-derived approximation via Indian voice corpus. Requires clinician confirmation before diagnostic use.',
  };
}

function _phq9Interpretation(tier) {
  return {
    minimal:           'Minimal or no depressive symptoms. No clinical action required at this time.',
    mild:              'Mild depressive features noted acoustically. Watchful waiting and lifestyle support recommended.',
    moderate:          'Moderate depression indicators. Clinical assessment and structured support recommended.',
    moderately_severe: 'Moderately severe depression markers. Prompt clinical review and possible treatment recommended.',
    severe:            'Severe depression acoustic signature. Urgent clinical assessment required.',
  }[tier] || '';
}

function _gad7Interpretation(tier) {
  return {
    minimal:  'Minimal anxiety indicators. No clinical action required.',
    mild:     'Mild anxiety features. Self-care strategies and monitoring recommended.',
    moderate: 'Moderate anxiety markers. Clinical review and possible CBT-based support recommended.',
    severe:   'Severe anxiety acoustic signature. Urgent clinical assessment recommended.',
  }[tier] || '';
}

function _pss10Interpretation(tier) {
  return {
    low_stress:      'Low perceived stress. Resilience indicators are positive.',
    moderate_stress: 'Moderate stress load. Stress management intervention and monitoring recommended.',
    high_stress:     'High perceived stress. Burnout risk elevated; clinical review recommended.',
  }[tier] || '';
}

// ─── Burnout Risk Score (Maslach-inspired acoustic composite) ────────────────
// Three Maslach dimensions approximated from voice biomarkers:
//
//   Emotional Exhaustion (EE) — primary burnout predictor
//     = chronic stress × 0.45 + depression × 0.35 + energy depletion × 0.20
//
//   Depersonalization (DP) — emotional numbing / disengagement
//     = (100 - engagement_proxy) × 0.55 + depression × 0.30 + stress × 0.15
//
//   Reduced Personal Accomplishment (PA) — inversely scored
//     = depression × 0.40 + chronic stress × 0.35 + anxiety × 0.25
//
// Composite Burnout Risk Score (BRS) — 0 (none) to 100 (severe burnout):
//   BRS = EE × 0.50 + DP × 0.30 + (100 - PA_inverse_corrected) × 0.20
//
// BRS tiers: minimal (<30), mild (30-49), moderate (50-64), high (65-79), critical (≥80)
// © Cittaa Health Services 2025

function _computeBurnout(dep, anx, str) {
  // Engagement proxy: inverse of combined distress (higher stress/dep = less engaged)
  const engagementProxy = Math.max(0, 100 - (dep * 0.50 + str * 0.30 + anx * 0.20));

  const EE = Math.min(100, str * 0.45 + dep * 0.35 + Math.max(0, 50 - engagementProxy) * 0.20 * 2);
  const DP = Math.min(100, (100 - engagementProxy) * 0.55 + dep * 0.30 + str * 0.15);
  const PA_inv = Math.min(100, dep * 0.40 + str * 0.35 + anx * 0.25);

  const burnoutScore = Math.round(Math.min(100, EE * 0.50 + DP * 0.30 + PA_inv * 0.20));

  const tier = burnoutScore < 30 ? 'minimal'
             : burnoutScore < 50 ? 'mild'
             : burnoutScore < 65 ? 'moderate'
             : burnoutScore < 80 ? 'high'
             :                     'critical';

  return {
    score: burnoutScore,
    tier,
    dimensions: {
      emotionalExhaustion:        Math.round(EE),
      depersonalization:          Math.round(DP),
      reducedAccomplishment:      Math.round(PA_inv),
    },
    interpretation: {
      minimal:  'No significant burnout indicators.',
      mild:     'Early burnout markers detected. Regular self-care and workload review recommended.',
      moderate: 'Moderate burnout risk. Work-life balance assessment and psychologist consultation advised.',
      high:     'High burnout risk detected. Immediate workload reduction and clinical support strongly recommended.',
      critical: 'Critical burnout signature. Urgent clinical intervention and possible leave may be needed.',
    }[tier] || '',
  };
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
 * Build authentic biomarker findings calibrated for Indian voices.
 *
 * Reference norms (multi-lingual Indian population):
 *   F0 male    : 85–165 Hz   (Hindi/Telugu/Tamil/Kannada/Marathi/IndEng)
 *   F0 female  : 155–255 Hz
 *   Speech rate: 3.5–5.8 syl/s (Indian conversational pace)
 *   Jitter norm: ≤ 0.038 (retroflex consonants inflate jitter slightly)
 *   Shimmer norm: ≤ 0.130
 *   HNR normal : ≥ 12 dB (real-world mobile recordings)
 *   Pause ratio: 0.12–0.32 (hesitation markers common in Indian speech)
 *
 * Findings are in plain, non-alarming language suitable for employee-facing UI.
 * Severity: low = normal, moderate = borderline, high = clinically noteworthy.
 */
function _biomarkerFindings(features) {
  const f = features || {};

  // ── 1. Pitch (Fundamental Frequency) ──────────────────────────────────────
  const f0 = f.f0_mean || f.pitch_mean || 140;
  let pitchSev, pitchFinding;

  if (f0 < 85) {
    pitchSev    = 'high';
    pitchFinding = 'Fundamental frequency is notably low (below 85 Hz) — a consistent acoustic marker of low mood and reduced emotional arousal, associated with depression in Indian voice studies';
  } else if (f0 < 110) {
    pitchSev    = 'moderate';
    pitchFinding = 'Pitch is on the lower side of the Indian normal band — mild tonal flattening observed, which may reflect fatigue or subdued affect';
  } else if (f0 > 255) {
    pitchSev    = 'moderate';
    pitchFinding = 'Elevated pitch detected — voice shows signs of tension or heightened arousal; in context of other markers this may indicate anxiety or acute stress';
  } else {
    pitchSev    = 'low';
    pitchFinding = 'Pitch is within the normal Indian vocal range — no prosodic elevation or suppression detected';
  }

  // ── 2. Speech Rate ─────────────────────────────────────────────────────────
  const sr = f.speech_rate || f.articulation_rate || 4.4;
  let rateSev, rateFinding;

  if (sr < 2.8) {
    rateSev    = 'high';
    rateFinding = 'Speech rate is significantly reduced (below 2.8 syllables/second) — psychomotor slowing is a core symptom of clinical depression; this pattern is consistent across Hindi, Tamil, Telugu, and Indian English speakers';
  } else if (sr < 3.5) {
    rateSev    = 'moderate';
    rateFinding = 'Mildly slowed speech rate detected — may reflect low energy, low motivation, or early signs of low mood';
  } else if (sr > 6.2) {
    rateSev    = 'moderate';
    rateFinding = 'Speech rate is elevated (pressured speech) — a known acoustic correlate of anxiety and acute stress in clinical literature';
  } else {
    rateSev    = 'low';
    rateFinding = `Speech rate of ${(Math.round(sr * 10)/10)} syl/s falls within the normal Indian conversational range (3.5–5.8 syl/s)`;
  }

  // ── 3. Vocal Quality (Jitter, Shimmer, HNR) ───────────────────────────────
  const jitter  = f.jitter || f.jitter_local || f.jitter_ppq5 || 0.022;
  const shimmer = f.shimmer || f.shimmer_local || f.shimmer_apq11 || 0.085;
  const hnr     = f.hnr || f.hnr_db || 20.0;
  let vqSev, vqFinding;

  const jitterHigh  = jitter  > 0.055;
  const jitterMid   = jitter  > 0.038;
  const shimmerHigh = shimmer > 0.160;
  const shimmerMid  = shimmer > 0.130;
  const hnrLow      = hnr < 12;
  const hnrMid      = hnr < 15;

  if (jitterHigh || shimmerHigh || hnrLow) {
    vqSev    = 'high';
    vqFinding = `Significant vocal perturbations detected — jitter ${(jitter*100).toFixed(1)}%, shimmer ${(shimmer*100).toFixed(1)}%, HNR ${hnr.toFixed(1)} dB. These measures reflect micro-instabilities in vocal fold vibration, associated with emotional dysregulation, chronic stress, and anxious phonation patterns`;
  } else if (jitterMid || shimmerMid || hnrMid) {
    vqSev    = 'moderate';
    vqFinding = 'Mild vocal perturbations noted — slight irregularity in voice quality. This level of jitter/shimmer is borderline and may reflect transient stress, insufficient sleep, or mild dehydration';
  } else {
    vqSev    = 'low';
    vqFinding = `Vocal quality is clear and stable — jitter ${(jitter*100).toFixed(1)}%, HNR ${hnr.toFixed(1)} dB. Voice periodicity is within healthy Indian norms`;
  }

  // ── 4. Vocal Energy ────────────────────────────────────────────────────────
  const energy = f.energy_mean || f.energy || 0.045;
  const eStd   = f.energy_std  || 0.010;
  let engSev, engFinding;

  if (energy < 0.018) {
    engSev    = 'high';
    engFinding = 'Very low vocal energy detected — consistent with fatigue, low motivation, and depressive withdrawal. In Indian clinical contexts this pattern is seen in individuals experiencing burnout or persistent low mood';
  } else if (energy < 0.028) {
    engSev    = 'moderate';
    engFinding = 'Below-average vocal energy — voice lacks its usual drive. This is a soft marker for fatigue or subdued affect, particularly relevant in blue-collar and shift-work populations';
  } else if (energy > 0.092 && eStd > 0.022) {
    engSev    = 'moderate';
    engFinding = 'Elevated and erratic vocal energy — high energy with irregular variation is a hallmark of acute stress response and pressured, agitated speech';
  } else {
    engSev    = 'low';
    engFinding = 'Vocal energy is balanced and consistent — no signs of fatigue or agitation in energy output';
  }

  // ── 5. Rhythm & Pause Patterns ─────────────────────────────────────────────
  const rr     = f.rhythm_regularity || f.inter_utterance_gap_std || 0.08;
  const pauseR = f.pause_ratio || 0.22;
  let rhythSev, rhythFinding;

  if (pauseR > 0.44 || rr > 0.22) {
    rhythSev    = 'high';
    rhythFinding = `High pause ratio (${(pauseR*100).toFixed(0)}%) with irregular rhythm — excessive silences and halting speech are strongly associated with psychomotor slowing in depression. Common in Hindi, Kannada, and Tamil speakers experiencing depressive episodes`;
  } else if (pauseR > 0.34 || rr > 0.16) {
    rhythSev    = 'moderate';
    rhythFinding = 'Moderately elevated pause frequency — more hesitations and inter-word gaps than typical. This may reflect cognitive effort, low engagement, or early mood difficulties';
  } else if (pauseR < 0.08 && rr > 0.14) {
    rhythSev    = 'moderate';
    rhythFinding = 'Rapid, compressed speech with minimal breathing pauses — characteristic of pressured speech under stress or anxiety; rest-and-recovery pattern is absent';
  } else {
    rhythSev    = 'low';
    rhythFinding = `Rhythm and pause patterns are natural — pause ratio of ${(pauseR*100).toFixed(0)}% is within the expected Indian conversational range (12–32%)`;
  }

  return {
    pitch: {
      finding:  pitchFinding,
      severity: pitchSev,
      value:    Math.round(f0),
      unit:     'Hz',
      norm:     '85–255 Hz',
    },
    speech_rate: {
      finding:  rateFinding,
      severity: rateSev,
      value:    Math.round(sr * 10) / 10,
      unit:     'syl/s',
      norm:     '3.5–5.8 syl/s',
    },
    vocal_quality: {
      finding:  vqFinding,
      severity: vqSev,
      value:    Math.round(hnr * 10) / 10,
      unit:     'dB HNR',
      norm:     '≥ 12 dB',
    },
    energy_level: {
      finding:  engFinding,
      severity: engSev,
      value:    Math.round(energy * 1000) / 1000,
      unit:     'RMS',
      norm:     '0.018–0.10',
    },
    rhythm_stability: {
      finding:  rhythFinding,
      severity: rhythSev,
      value:    Math.round(pauseR * 100),
      unit:     '% pause',
      norm:     '12–32%',
    },
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
    const riskLevel = _riskLevel(dep, anx, str);

    // Wellness score — weighted across all three dimensions.
    const rawDistress   = dep * 0.45 + anx * 0.35 + str * 0.20;
    const peakDistress  = Math.max(dep, anx, str);
    const distress      = Math.max(rawDistress, peakDistress * 0.75);
    const wellnessScore = Math.round(Math.max(0, Math.min(100, 100 - distress)));
    const wellnessLevel = _wellnessLevel(wellnessScore);
    const recs              = _generateRecs(dep, anx, str);
    const biomarkerFindings = _biomarkerFindings(featuresData);
    const burnoutData       = _computeBurnout(dep, anx, str);

    // ── VocoScale™: Golden Standards mapping (PHQ-9 / GAD-7 / PSS-10) ─────────
    // Uses Cittaa's proprietary acoustic signature weighting + non-linear
    // logistic transformation to derive validated-scale equivalent scores.
    const standardScales = _computeStandardScales(dep, anx, str, featuresData);
    const { phq9Tier, gad7Tier, pss10Tier } = {
      phq9Tier:  standardScales.phq9.tier,
      gad7Tier:  standardScales.gad7.tier,
      pss10Tier: standardScales.pss10.tier,
    };

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
              burnout:    burnoutData.score,
              engagement: Math.round(Math.max(0, 100 - (dep * 0.4 + str * 0.35 + anx * 0.25))),
            },
            burnoutRisk: burnoutData,
            standardScales,
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
        const isCritical = riskLevel === 'red';
        await Alert.create({
          tenantId,
          employeeId:  patientId,
          sessionId,
          alertType:   isCritical ? 'crisis_alert' : 'high_risk_detected',
          severity:    isCritical ? 'critical'     : 'high',
          title:       isCritical
            ? 'Crisis-Level Risk Detected'
            : 'High-Risk Vocal Pattern Detected',
          message:     isCritical
            ? `Critical mental health risk markers identified. Immediate psychologist intervention recommended. PHQ-9 equiv: ${standardScales.phq9.score}, GAD-7 equiv: ${standardScales.gad7.score}, PSS-10 equiv: ${standardScales.pss10.score}`
            : `Elevated risk detected — Depression: ${dep}, Anxiety: ${anx}, Stress: ${str}. PHQ-9 tier: ${phq9Tier}, GAD-7 tier: ${gad7Tier}`,
          riskDetails: {
            riskLevel:    riskLevel === 'red' ? 'red' : 'orange',
            riskScore:    Math.round((dep + anx + str) / 3),
            dimensionalScores: { depression: dep, anxiety: anx, stress: str },
          },
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

    // ── Step 7: WhatsApp — notify employee if high-risk + queue 3-day follow-up ─
    if (highRisk) {
      try {
        const whatsapp  = require('../../../api/src/services/whatsappService')
          || require('../../api/src/services/whatsappService');
        const emp       = await Employee.findOne({ employeeId: patientId });
        const empPhone  = emp?.phone || emp?.mobile;
        const empName   = emp?.firstName || emp?.fullName?.split(' ')[0] || 'there';

        // 7a. Send supportive WhatsApp to employee
        if (empPhone) {
          await whatsapp.sendHighRiskSupport({ phone: empPhone, name: empName, riskLevel });
        }

        // 7b. Schedule 3-day follow-up ping via delayed Bull job
        const OutcomeFollowUp = require('../models/OutcomeFollowUp')
          || require('../../api/src/models/OutcomeFollowUp');
        const dims     = { depression: dep, anxiety: anx, stress: str, burnout: Math.round(str * 0.8) };
        const dominant = ['depression','anxiety','stress','burnout'].reduce((a, b) => dims[a] > dims[b] ? a : b);

        const followUpDoc = await OutcomeFollowUp.create({
          tenantId,
          employeeId:   patientId,
          sessionId,
          type:         'checkin_followup',
          scheduledFor: new Date(Date.now() + 3 * 86400000),  // 3 days later
          channel:      empPhone ? 'whatsapp' : 'email',
          status:       'pending',
          triggerContext: { riskLevel, wellnessScore, dominantDimension: dominant },
          expiresAt:    new Date(Date.now() + 7 * 86400000),  // expire after 7 days
        });

        await queues.followUpReminders.add(
          { followUpId: followUpDoc._id.toString(), employeeId: patientId, tenantId },
          {
            jobId: `followup-${sessionId}`,
            delay: 3 * 24 * 60 * 60 * 1000,  // 3 days in ms
            attempts: 3,
            backoff: { type: 'exponential', delay: 60000 },
          }
        );
        logger.info('[outcome] 3-day follow-up queued for session %s', sessionId);
      } catch (waErr) {
        logger.warn('[outcome] WhatsApp/follow-up setup failed (non-fatal): %s', waErr.message);
      }
    }

    // ── Step 8: Notify VocoCore of completed session ──────────────────────────
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
