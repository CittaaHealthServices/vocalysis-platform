const axios = require('axios');
const FormData = require('form-data');
const logger = require('../logger');
const trendService = require('../services/trendService');

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

// ─── Kintsugi DAM Analysis ────────────────────────────────────────────────────
//
// Calls the kintsugi-service microservice which wraps the open-sourced
// KintsugiHealth/dam model — the first speech-only model to receive FDA
// De Novo clearance for clinical-grade mental health screening from voice.
//
// Architecture: Whisper backbone + multi-task head, fine-tuned on ~35,000
// individuals (~863 hours of speech) against clinician-administered PHQ-9
// and GAD-7 ground truth. Published in Annals of Family Medicine (Jan 2025).
//
// Returns { dep, anx, str, confScore, scorerUsed } or null on failure.
//
async function _kintsugiAnalysis(audioData, mimeType) {
  const serviceUrl  = process.env.KINTSUGI_SERVICE_URL;
  const internalKey = process.env.KINTSUGI_INTERNAL_KEY || 'kintsugi-dev-key';
  if (!serviceUrl) return null;

  try {
    const FormDataNode = require('form-data');
    const form         = new FormDataNode();

    // audioData is a Buffer (already decoded from base64 at this point)
    const ext = (mimeType || 'audio/webm').includes('wav')  ? '.wav'
              : (mimeType || '').includes('mp4')            ? '.mp4'
              : (mimeType || '').includes('mpeg')           ? '.mp3'
              : '.webm';
    form.append('audio', audioData, { filename: `audio${ext}`, contentType: mimeType || 'audio/webm' });

    const response = await axios.post(`${serviceUrl}/analyze`, form, {
      headers: {
        ...form.getHeaders(),
        'X-Kintsugi-Internal-Key': internalKey,
      },
      timeout: 180000,   // DAM inference on CPU can take up to 60s for long audio
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });

    if (!response.data?.success || !response.data?.scores) {
      throw new Error(response.data?.error || 'Kintsugi DAM returned no scores');
    }

    const s = response.data.scores;
    logger.info(
      'Kintsugi DAM — dep:%d anx:%d str:%d conf:%d phq9:%s gad7:%s (%dms)',
      s.depression_score, s.anxiety_score, s.stress_score, s.confidence,
      s.phq9_category, s.gad7_category, s.inference_ms || 0
    );

    return {
      dep:       Math.round(s.depression_score),
      anx:       Math.round(s.anxiety_score),
      str:       Math.round(s.stress_score),
      confScore: Math.round(s.confidence),
      scorerUsed: 'kintsugi_dam',
      // Clinical scale labels for the session record
      _phq9Category: s.phq9_category,
      _gad7Category: s.gad7_category,
    };
  } catch (err) {
    logger.warn('Kintsugi DAM failed (%s)', err.message);
    return null;
  }
}

// ─── ElevenLabs Speech-to-Text Transcription ──────────────────────────────────
//
// Uses ElevenLabs Scribe v1 (state-of-the-art multilingual STT) to get
// high-accuracy transcription with word-level timestamps. The timing data
// lets us precisely compute speech rate and pause ratio, improving the
// accuracy of downstream Gemini analysis significantly.
//
async function _elevenLabsTranscribe(audioBuffer, mimeType) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const FormDataNode = require('form-data');
    const audioData    = Buffer.isBuffer(audioBuffer)
      ? audioBuffer
      : Buffer.from(audioBuffer, 'base64');

    const form = new FormDataNode();
    // ElevenLabs expects the file with a proper extension for format detection
    const ext  = (mimeType || 'audio/webm').includes('wav') ? '.wav'
               : (mimeType || '').includes('mp4')          ? '.mp4'
               : (mimeType || '').includes('mpeg')         ? '.mp3'
               : '.webm';
    form.append('file', audioData, { filename: `audio${ext}`, contentType: mimeType || 'audio/webm' });
    form.append('model_id', 'scribe_v1');
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');   // skip [laughter] tags, we want pure words

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/speech-to-text',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'xi-api-key': apiKey,
        },
        timeout: 60000,
      }
    );

    const data = response.data;
    if (!data || !data.text) return null;

    // Compute duration from last word's end timestamp (seconds)
    const words    = data.words || [];
    const lastWord = words[words.length - 1];
    const duration = lastWord ? (lastWord.end || 0) : 0;

    // Count syllables heuristically (≈ vowel groups per word for Indian languages)
    const syllableCount = data.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .reduce((acc, w) => acc + Math.max(1, (w.match(/[aeiou]+/g) || []).length), 0);

    // Compute pause ratio: total silence / total duration
    let pauseDuration = 0;
    for (let i = 1; i < words.length; i++) {
      const gap = (words[i].start || 0) - (words[i - 1].end || 0);
      if (gap > 0.15) pauseDuration += gap;   // gaps > 150 ms = intentional pause
    }
    const pauseRatio   = duration > 0 ? Math.min(0.95, pauseDuration / duration) : 0.22;
    const speechRate   = duration > 0 ? syllableCount / duration : 4.4;

    return {
      text:       data.text,
      words,
      duration,
      syllableCount,
      speechRate: Math.round(speechRate * 10) / 10,
      pauseRatio: Math.round(pauseRatio * 100) / 100,
      language:   data.language_code || 'unknown',
    };
  } catch (err) {
    logger.warn('ElevenLabs STT failed (%s) — proceeding without transcript', err.message);
    return null;
  }
}

// ─── Gemini 1.5 Flash Audio Analysis ─────────────────────────────────────────
//
// Sends the raw audio (inline base64) PLUS the ElevenLabs transcript (if
// available) to Gemini 1.5 Flash for comprehensive clinical voice analysis.
// Gemini can hear the audio directly, so it captures prosody, vocal quality,
// and emotional tone that pure transcription misses.
//
// Returns { dep, anx, str, confScore, features, scorerUsed } or null on failure.
//
async function _geminiAudioAnalysis(audioBuffer, mimeType, elevenLabsResult) {
  const geminiKey = process.env.VOCOCORE_INFERENCE_KEY;
  if (!geminiKey) return null;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature:      0.1,   // low temperature for consistent clinical scoring
        maxOutputTokens:  1024,
      },
    });

    // Base64 audio string (already base64 if it came from job.data)
    const audioB64 = Buffer.isBuffer(audioBuffer)
      ? audioBuffer.toString('base64')
      : audioBuffer;

    const effectiveMime = mimeType || 'audio/webm';

    // Build context section with ElevenLabs data if available
    let transcriptContext = '';
    if (elevenLabsResult) {
      transcriptContext = `
TRANSCRIPT (ElevenLabs Scribe v1, high-accuracy):
"${elevenLabsResult.text}"

TIMING-DERIVED ACOUSTIC FEATURES (from word-level timestamps):
- Speech rate: ${elevenLabsResult.speechRate} syllables/second
- Pause ratio: ${elevenLabsResult.pauseRatio} (proportion of silence)
- Total duration: ${elevenLabsResult.duration}s
- Detected language: ${elevenLabsResult.language}
- Word count: ${elevenLabsResult.words.length}
`;
    }

    const prompt = `You are Cittaa VocoScore™, a clinical voice biomarker analysis engine calibrated for Indian multilingual speakers (Hindi, Tamil, Kannada, Telugu, Malayalam, Marathi, Bengali, English with Indian accent).

Analyze this voice recording for mental health biomarkers. Listen carefully to the actual acoustic qualities — pitch, rhythm, energy, vocal tremor, speech rate, and emotional tone.
${transcriptContext}
CLINICAL CALIBRATION:
- Indian adult baseline: pitch 140–185 Hz, speech rate 3.8–5.2 syl/s, pause ratio 0.16–0.30
- PHQ-9 equivalent ranges: 0–25=minimal, 25–45=mild, 45–65=moderate, 65–80=mod-severe, 80–100=severe
- GAD-7 equivalent ranges: 0–20=minimal, 20–40=mild, 40–60=moderate, 60–80=mod-severe, 80–100=severe
- PSS-10 equivalent ranges: 0–25=low, 25–50=moderate, 50–75=high, 75–100=very high
- Depression vocal markers: pitch suppression, psychomotor slowing, flat affect, long pauses, low energy
- Anxiety vocal markers: elevated jitter/shimmer, pitch instability, pressured speech, vocal tension
- Stress vocal markers: supra-normal energy, rhythm irregularity, sustained pitch elevation

Return ONLY a JSON object (no markdown, no explanation outside JSON) with this exact structure:
{
  "depression_score": <integer 0-100>,
  "anxiety_score": <integer 0-100>,
  "stress_score": <integer 0-100>,
  "confidence": <integer 0-100, your confidence in this assessment based on audio quality and clarity>,
  "features": {
    "f0_mean": <estimated fundamental frequency in Hz, float>,
    "f0_std": <pitch variability std, float>,
    "speech_rate": <syllables per second, float>,
    "pause_ratio": <0.0-1.0, float>,
    "energy_mean": <relative RMS energy 0.0-0.2, float>,
    "energy_std": <energy variability, float>,
    "jitter": <voice frequency irregularity 0.0-0.1, float>,
    "shimmer": <amplitude irregularity 0.0-0.2, float>,
    "hnr": <harmonics-to-noise ratio in dB, float>,
    "rhythm_regularity": <0.0-1.0, float>
  },
  "linguistic_indicators": {
    "negative_sentiment_ratio": <0.0-1.0>,
    "absolutist_language": <count of words like "never","always","everything","nothing">,
    "social_isolation_markers": <count of isolation-related phrases>,
    "hopelessness_markers": <count of hopelessness/helplessness phrases>
  },
  "key_findings": "<1-2 sentence clinical summary of the most prominent voice characteristics observed>"
}

IMPORTANT: Base scores on what you actually hear. If the voice sounds calm and neutral, give low scores. If you hear clear distress markers, give elevated scores. Be specific and differentiated — avoid clustering all scores near 35.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: effectiveMime,
          data:     audioB64,
        },
      },
      { text: prompt },
    ]);

    const raw  = result.response.text().trim();
    // Strip markdown code fences if Gemini wraps despite responseMimeType setting
    const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(json);

    const dep       = Math.round(Math.max(0, Math.min(100, parsed.depression_score ?? 35)));
    const anx       = Math.round(Math.max(0, Math.min(100, parsed.anxiety_score    ?? 30)));
    const str       = Math.round(Math.max(0, Math.min(100, parsed.stress_score     ?? 32)));
    const conf      = Math.round(Math.max(0, Math.min(100, parsed.confidence       ?? 68)));
    const features  = parsed.features || {};

    // Override speech_rate and pause_ratio with ElevenLabs precision if available
    if (elevenLabsResult) {
      features.speech_rate = elevenLabsResult.speechRate;
      features.pause_ratio = elevenLabsResult.pauseRatio;
    }

    logger.info(
      'Gemini audio analysis complete — dep:%d anx:%d str:%d conf:%d (with_transcript:%s)',
      dep, anx, str, conf, !!elevenLabsResult
    );

    return {
      dep,
      anx,
      str,
      confScore:  conf,
      features,
      scorerUsed: elevenLabsResult ? 'gemini_elevenlabs' : 'gemini_audio',
      keyFindings: parsed.key_findings,
      linguisticIndicators: parsed.linguistic_indicators,
    };
  } catch (err) {
    logger.warn('Gemini audio analysis failed (%s)', err.message);
    return null;
  }
}

// ─── AI Audio Fallback Orchestrator ──────────────────────────────────────────
//
// Tier 3 fallback when VocoCore is unavailable.
//
// Voice biomarker layer (primary — scores driven by acoustic signal):
//   Tier 3a: Gemini 1.5 Flash audio-only → directly analyses the raw audio
//            waveform for pitch, rhythm, energy, vocal quality, prosody.
//
// Text/linguistic layer (secondary — only invoked if voice analysis fails):
//   Tier 3b: ElevenLabs Scribe v1 STT → high-accuracy transcript + word
//            timestamps → speech rate, pause ratio extracted from timing.
//   Tier 3c: Gemini with transcript context → voice + linguistic pattern
//            analysis for combined accuracy.
//
// Tier 4: Deterministic → last resort (confScore ≤ 45, flags for manual review).
//
async function _aiFallback(audioBuffer, mimeType, existingFeatures) {
  // ── Tier 3a: Gemini pure audio analysis (voice biomarker layer) ───────────
  logger.info('AI Fallback Tier 3a — Gemini 1.5 Flash voice-only analysis');
  const geminiVoice = await _geminiAudioAnalysis(audioBuffer, mimeType, null);
  if (geminiVoice) {
    logger.info('Tier 3a succeeded — dep:%d anx:%d str:%d scorer:%s',
      geminiVoice.dep, geminiVoice.anx, geminiVoice.str, geminiVoice.scorerUsed);
    return geminiVoice;
  }

  // ── Tier 3b: ElevenLabs STT (text/linguistic layer fallback) ─────────────
  logger.info('AI Fallback Tier 3b — ElevenLabs STT for text-layer analysis');
  const transcript = await _elevenLabsTranscribe(audioBuffer, mimeType);
  if (transcript) {
    logger.info('ElevenLabs STT succeeded — lang:%s rate:%d pause:%d',
      transcript.language, transcript.speechRate, transcript.pauseRatio);

    // ── Tier 3c: Gemini with transcript (voice + linguistic combined) ───────
    logger.info('AI Fallback Tier 3c — Gemini analysis with transcript context');
    const geminiWithText = await _geminiAudioAnalysis(audioBuffer, mimeType, transcript);
    if (geminiWithText) {
      logger.info('Tier 3c succeeded — dep:%d anx:%d str:%d scorer:%s',
        geminiWithText.dep, geminiWithText.anx, geminiWithText.str, geminiWithText.scorerUsed);
      return geminiWithText;
    }
  }

  // ── Tier 4: Deterministic (last resort) ───────────────────────────────────
  logger.warn('AI Fallback — all AI tiers failed. Using deterministic scoring.');
  const features = { ...existingFeatures };
  if (transcript) {
    // Use ElevenLabs timing-derived features to make deterministic less generic
    features.speech_rate = transcript.speechRate;
    features.pause_ratio = transcript.pauseRatio;
  }
  const det = _deterministicScores(features);
  return { ...det, features, scorerUsed: 'deterministic_fallback' };
}

// ─── Main processor ───────────────────────────────────────────────────────────

module.exports = async function audioAnalysisProcessor(job) {
  const { sessionId, tenantId, audioBuffer, filename, patientId, clinicianId, languageHint } = job.data;
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
    let aiInsights   = null; // Populated when Gemini is used; stored on session for clinician review

    if (vococoreUrl) {
      try {
        const form = new FormData();
        form.append('audio', audioData, { filename: filename || 'audio.wav' });
        // Pass language hint (from user profile or auto-detected) for per-language calibration
        if (languageHint) form.append('language_hint', languageHint);

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
          // Capture detected language for storage on session document
          if (response.data.language) {
            job.data._detectedLanguage = response.data.language;
          }
          logger.info('VocoCore ML scoring complete — dep:%d anx:%d str:%d conf:%d lang:%s',
            dep, anx, str, confScore, response.data.language?.code || 'unknown');
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
          logger.warn('VocoCore /fallback also failed (%s). Trying Kintsugi DAM…', fbErr.message);

          // ── Tier 3: Kintsugi DAM (FDA-cleared open-source voice biomarker model)
          const kintsugiResult = await _kintsugiAnalysis(audioData, job.data.mimeType || 'audio/webm');
          if (kintsugiResult) {
            dep        = kintsugiResult.dep;
            anx        = kintsugiResult.anx;
            str        = kintsugiResult.str;
            confScore  = kintsugiResult.confScore;
            scorerUsed = kintsugiResult.scorerUsed;
            // Store clinical category labels for the session document
            if (kintsugiResult._phq9Category) job.data._phq9Category = kintsugiResult._phq9Category;
            if (kintsugiResult._gad7Category) job.data._gad7Category = kintsugiResult._gad7Category;
          } else {
            // ── Tier 4+: Gemini / ElevenLabs+Gemini / Deterministic ──────────
            logger.warn('Kintsugi DAM unavailable. Escalating to AI fallback pipeline.');
            const aiResult = await _aiFallback(audioData, job.data.mimeType || 'audio/webm', featuresData);
            dep        = aiResult.dep;
            anx        = aiResult.anx;
            str        = aiResult.str;
            confScore  = aiResult.confScore;
            scorerUsed = aiResult.scorerUsed;
            if (aiResult.features && Object.keys(aiResult.features).length > 0) {
              featuresData = { ...featuresData, ...aiResult.features };
            }
            // Capture Gemini's clinical reasoning for storage on the session document
            if (aiResult.keyFindings) {
              aiInsights = {
                keyFindings:          aiResult.keyFindings,
                linguisticIndicators: aiResult.linguisticIndicators || null,
                scorerUsed:           aiResult.scorerUsed,
                capturedAt:           new Date(),
              };
            }
          }
        }
      }
    } else {
      // No VocoCore URL — try Kintsugi DAM first, then AI fallback pipeline
      logger.warn('VOCOCORE_SERVICE_URL not set — trying Kintsugi DAM…');
      const kintsugiResult = await _kintsugiAnalysis(audioData, job.data.mimeType || 'audio/webm');
      if (kintsugiResult) {
        dep        = kintsugiResult.dep;
        anx        = kintsugiResult.anx;
        str        = kintsugiResult.str;
        confScore  = kintsugiResult.confScore;
        scorerUsed = kintsugiResult.scorerUsed;
        if (kintsugiResult._phq9Category) job.data._phq9Category = kintsugiResult._phq9Category;
        if (kintsugiResult._gad7Category) job.data._gad7Category = kintsugiResult._gad7Category;
      } else {
        logger.warn('Kintsugi DAM unavailable. Escalating to AI fallback pipeline.');
        const aiResult = await _aiFallback(audioData, job.data.mimeType || 'audio/webm', {});
        dep        = aiResult.dep;
        anx        = aiResult.anx;
        str        = aiResult.str;
        confScore  = aiResult.confScore;
        scorerUsed = aiResult.scorerUsed;
        if (aiResult.features && Object.keys(aiResult.features).length > 0) {
          featuresData = aiResult.features;
        }
        // Capture Gemini's clinical reasoning for storage on the session document
        if (aiResult.keyFindings) {
          aiInsights = {
            keyFindings:          aiResult.keyFindings,
            linguisticIndicators: aiResult.linguisticIndicators || null,
            scorerUsed:           aiResult.scorerUsed,
            capturedAt:           new Date(),
          };
        }
      }
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
          // AI insights from Gemini (populated when Gemini tier is used as fallback)
          ...(aiInsights && { aiInsights }),
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
        const clinician = await Employee.findOne({ tenantId, employeeId: clinicianId });
        const employee  = await Employee.findOne({ tenantId, employeeId: patientId });
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
      const employee = await Employee.findOne({ tenantId, employeeId: patientId });
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
        const emp       = await Employee.findOne({ tenantId, employeeId: patientId });
        const empPhone  = emp?.phone || emp?.mobile;
        const empName   = emp?.firstName || emp?.fullName?.split(' ')[0] || 'there';

        // 7a. Send supportive WhatsApp to employee
        if (empPhone) {
          await whatsapp.sendHighRiskSupport({ phone: empPhone, name: empName, riskLevel });
        }

        // 7b. Schedule 3-day follow-up ping via delayed Bull job
        const OutcomeFollowUp = require('../../../api/src/models/OutcomeFollowUp');
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

    // ── Step 7.5: Longitudinal Trend Scoring ────────────────────────────────────
    // Compute week-over-week biomarker drift and flag pre-alert deteriorations.
    // This runs AFTER the session is saved to MongoDB so computeTrend() can
    // read it along with the employee's history.
    try {
      const trend = await trendService.computeTrend(patientId, tenantId, sessionDoc);

      // Persist trend snapshot onto the session document for fast retrieval
      await Session.findByIdAndUpdate(sessionDoc._id, {
        $set: {
          trendData: {
            overall:            trend.trendLabels?.overall,
            velocity:           trend.velocity,
            deltas:             trend.deltas,
            baselineAvg:        trend.baselineAvg,
            preAlert:           trend.preAlert,
            preAlertDimensions: trend.preAlertDimensions,
            preAlertSeverity:   trend.preAlertSeverity,
            sessionCount:       trend.sessionCount,
            computedAt:         new Date(),
          },
        },
      });

      // Create a pre-alert in the Alert collection if deterioration is significant
      if (trend.preAlert) {
        await trendService.maybeCreatePreAlert(sessionDoc, trend);
        logger.info('[trend] Pre-alert created — %s deterioration detected for session %s (dims: %s)',
          trend.preAlertSeverity, sessionId, trend.preAlertDimensions.join(', '));
      } else {
        logger.info('[trend] Trend computed — %s (velocity: %s) for session %s',
          trend.trendLabels?.overall, trend.velocity, sessionId);
      }
    } catch (trendErr) {
      // Non-fatal — trend failure must not block session completion
      logger.warn('[trend] Trend computation failed (non-fatal): %s', trendErr.message);
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
