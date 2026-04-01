/**
 * VocaCoreEngine — Cittaa Health Services
 * =========================================
 * Primary:  Indian-calibrated sklearn ML model via VocoCore /score endpoint
 *           (96.44% accuracy, Hindi/Telugu/Tamil/Kannada/IndEng calibration)
 * Fallback: Gemini 2.5 Flash via VOCOCORE_INFERENCE_KEY (if Python service down)
 * Final:    Deterministic rule-based scoring (if both above fail)
 *
 * The /score endpoint does feature extraction + ML inference in one call.
 * When it succeeds, session.audioFeatures is populated from its response too,
 * so the separate /extract call in featureExtractionService becomes optional.
 */

const axios   = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger  = require('../utils/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

const ENGINE_VERSION = 'VocoCore™ 2.1-India';

// Thresholds for derived clinical fields
const RISK = {
  critical:  { depression: 80, anxiety: 80, stress: 85 },
  high:      { depression: 65, anxiety: 65, stress: 70 },
  moderate:  { depression: 45, anxiety: 45, stress: 50 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive overall_risk_level from three scores.
 */
function _riskLevel(dep, anx, str) {
  const max = Math.max(dep, anx, str);
  if (dep >= RISK.critical.depression || anx >= RISK.critical.anxiety || str >= RISK.critical.stress)
    return 'critical';
  if (dep >= RISK.high.depression || anx >= RISK.high.anxiety || str >= RISK.high.stress)
    return 'high';
  if (dep >= RISK.moderate.depression || anx >= RISK.moderate.anxiety || str >= RISK.moderate.stress)
    return 'moderate';
  return 'low';
}

/**
 * Recommend follow-up interval from risk level.
 */
function _followupWeeks(riskLevel) {
  return { critical: 1, high: 2, moderate: 4, low: 8 }[riskLevel] ?? 4;
}

/**
 * Build biomarker findings from extracted features (if available) and scores.
 */
function _biomarkerFindings(features, scores) {
  const f = features || {};

  // Pitch finding
  const f0 = f.f0_mean || f.pitch_mean || 174;
  const pitchSev = f0 < 120 ? 'high' : f0 < 145 ? 'moderate' : 'low';
  const pitchFinding = f0 < 120
    ? 'Low fundamental frequency — consistent with reduced emotional arousal'
    : f0 > 220 ? 'Elevated pitch — consistent with heightened emotional state'
    : 'Pitch within normal Indian voice range';

  // Speech rate finding
  const sr = f.speech_rate || f.rate_syllables || 4.4;
  const rateSev = sr < 3.0 ? 'high' : sr < 3.5 ? 'moderate' : sr > 5.8 ? 'moderate' : 'low';
  const rateFinding = sr < 3.0
    ? 'Significantly reduced speech rate — key depression indicator'
    : sr < 3.5 ? 'Mildly slowed speech rate'
    : sr > 5.8 ? 'Elevated speech rate — possible anxiety marker'
    : 'Speech rate within normal Indian range (4.2–5.2 syl/s)';

  // Vocal quality (jitter/shimmer/HNR)
  const jitter  = f.jitter || f.jitter_local || 0.021;
  const shimmer = f.shimmer || f.shimmer_local || 0.073;
  const hnr     = f.hnr || f.hnr_db || 20.5;
  const vqSev   = jitter > 0.040 || shimmer > 0.11 ? 'high'
                : jitter > 0.030 || shimmer > 0.09  ? 'moderate' : 'low';
  const vqFinding = vqSev === 'high'
    ? 'Elevated jitter/shimmer with reduced HNR — vocal irregularity detected'
    : vqSev === 'moderate' ? 'Mild vocal perturbations detected'
    : 'Vocal quality within normal range';

  // Energy finding
  const energy = f.energy_mean || f.energy || 0.050;
  const engSev = energy < 0.025 ? 'high' : energy < 0.035 ? 'moderate' : energy > 0.085 ? 'moderate' : 'low';
  const engFinding = energy < 0.025
    ? 'Very low vocal energy — consistent with fatigue or depression'
    : energy < 0.035 ? 'Below-average vocal energy'
    : energy > 0.085 ? 'Elevated vocal energy — possible stress or Lombard effect'
    : 'Vocal energy within normal range';

  // Rhythm finding
  const rhythm   = f.rhythm_regularity || 0.74;
  const pauseR   = f.pause_ratio || 0.22;
  const rhythSev = rhythm < 0.55 || pauseR > 0.45 ? 'high'
                 : rhythm < 0.65 || pauseR > 0.35 ? 'moderate' : 'low';
  const rhythFinding = pauseR > 0.45
    ? 'High pause ratio — significant silence patterns detected'
    : rhythm < 0.60 ? 'Irregular speech rhythm pattern'
    : 'Rhythm and pause patterns within expected range';

  return {
    pitch:           { finding: pitchFinding,   severity: pitchSev  },
    speech_rate:     { finding: rateFinding,    severity: rateSev   },
    vocal_quality:   { finding: vqFinding,      severity: vqSev     },
    energy_level:    { finding: engFinding,     severity: engSev    },
    rhythm_stability:{ finding: rhythFinding,   severity: rhythSev  },
  };
}

/**
 * Build clinical_flags list from scores.
 */
function _clinicalFlags(dep, anx, str, features) {
  const flags = [];
  if (dep >= 65) flags.push(`Depression risk elevated (score: ${dep})`);
  if (anx >= 65) flags.push(`Anxiety risk elevated (score: ${anx})`);
  if (str >= 70) flags.push(`Stress level elevated (score: ${str})`);

  const f = features || {};
  const pauseR = f.pause_ratio || 0;
  if (pauseR > 0.45) flags.push('Extended silence patterns — clinical follow-up recommended');

  const jitter = f.jitter || f.jitter_local || 0;
  if (jitter > 0.045) flags.push('Significant vocal perturbations detected');

  return flags;
}

/**
 * Normalise VocoCore /score response into the canonical engine result shape.
 */
function _normaliseMLResult(scoreResponse, latencyMs) {
  const s = scoreResponse.scores || {};
  const f = scoreResponse.features || {};
  const meta = scoreResponse.meta || {};

  const dep = s.depression_score   ?? 0;
  const anx = s.anxiety_score      ?? 0;
  const str = s.stress_score       ?? 0;
  const sta = s.emotional_stability_score ?? (100 - Math.max(dep, anx, str));

  // Confidence from ML: model_accuracy * ml_confidence
  const mlConf     = (s.ml_confidence ?? 0.95) * 100;
  const mlAccuracy = s.model_accuracy ?? 96.44;
  const confScore  = Math.round((mlConf + mlAccuracy) / 2);

  const riskLevel = _riskLevel(dep, anx, str);

  return {
    depression_score:         Math.round(dep),
    anxiety_score:            Math.round(anx),
    stress_score:             Math.round(str),
    emotional_stability_score:Math.round(sta),
    confidence_score:         Math.min(100, confScore),
    biomarker_findings:       _biomarkerFindings(f, s),
    clinical_flags:           _clinicalFlags(dep, anx, str, f),
    recommended_followup_weeks: _followupWeeks(riskLevel),
    alert_trigger:            riskLevel === 'high' || riskLevel === 'critical',
    overall_risk_level:       riskLevel,
    confidence:               Math.min(100, confScore),
    ml_class:                 s.ml_class     ?? 'unknown',
    ml_confidence:            s.ml_confidence ?? 0,
    class_probabilities:      s.class_probabilities ?? {},
    model_version:            s.model_version ?? '2.1-india',
    model_accuracy:           mlAccuracy,
    calibration:              meta.calibration ?? 'Indian voices',
    scorer_used:              meta.scorer_used ?? 'ml_ensemble_v2',
    engineVersion:            ENGINE_VERSION,
    inferenceLatencyMs:       latencyMs,
    fallbackUsed:             false,
    // Surface extracted features so caller can store them on session
    extractedFeatures:        f,
  };
}

// ─── Engine class ─────────────────────────────────────────────────────────────

class VocaCoreEngine {
  constructor() {
    this.engineVersion = ENGINE_VERSION;
    this._vocacoreUrl = process.env.VOCOCORE_SERVICE_URL; // e.g. http://localhost:5001
    this._internalKey = process.env.VOCOCORE_INTERNAL_KEY;

    // Gemini client for fallback (only initialised if key present)
    if (process.env.VOCOCORE_INFERENCE_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.VOCOCORE_INFERENCE_KEY);
        this._gemini = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      } catch (_) {
        this._gemini = null;
      }
    } else {
      this._gemini = null;
    }
  }

  // ── Primary: ML model via /score ──────────────────────────────────────────

  /**
   * analyzeAudio — primary entry point.
   * Sends raw audio to VocoCore /score → returns canonical result.
   *
   * @param {Buffer} audioBuffer  raw audio bytes
   * @param {string} filename     original filename (for mime detection)
   * @returns {Promise<object>}   canonical result shape
   */
  async analyzeAudio(audioBuffer, filename) {
    if (!this._vocacoreUrl) {
      logger.warn('VOCOCORE_SERVICE_URL not set — falling back to Gemini / deterministic');
      // No audio-based features available; use deterministic fallback
      return this._deterministicFallback({}, 0);
    }

    const start = Date.now();
    try {
      const form = new FormData();
      form.append('audio', audioBuffer, { filename: filename || 'audio.wav' });

      const response = await axios.post(
        `${this._vocacoreUrl}/score`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-VocoCore-Internal-Key': this._internalKey || '',
          },
          timeout: 120_000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'VocoCore /score returned failure');
      }

      logger.info('VocoCore ML scoring complete', {
        mlClass: response.data.scores?.ml_class,
        conf:    response.data.scores?.ml_confidence,
        latency: Date.now() - start,
      });

      return _normaliseMLResult(response.data, Date.now() - start);

    } catch (err) {
      logger.error('VocoCore /score failed, trying Gemini fallback', {
        error: err.message,
        code:  err.code,
      });
      // Fall through to Gemini
      return this._geminiFallback({}, Date.now() - start);
    }
  }

  /**
   * analyze — legacy entry point called from sessions.routes.js with a feature dict.
   * Kept for backward compatibility.
   * When VOCOCORE_SERVICE_URL is available and audio buffer is not,
   * falls back to Gemini/deterministic on the feature dict.
   *
   * @param {object} featureVector  feature dict from featureExtractionService
   * @returns {Promise<object>}
   */
  async analyze(featureVector) {
    const start = Date.now();
    // Try Gemini first if key is available (features-only path)
    if (this._gemini) {
      try {
        return await this._geminiAnalyze(featureVector, start);
      } catch (err) {
        logger.error('Gemini fallback failed', { error: err.message });
      }
    }
    return this._deterministicFallback(featureVector, Date.now() - start);
  }

  // ── Gemini fallback ───────────────────────────────────────────────────────

  async _geminiFallback(features, latencyMs) {
    if (this._gemini) {
      try {
        return await this._geminiAnalyze(features, Date.now() - latencyMs);
      } catch (_) {}
    }
    return this._deterministicFallback(features, latencyMs);
  }

  async _geminiAnalyze(features, startTs) {
    const prompt = this._buildGeminiPrompt(features);
    const result = await this._gemini.generateContent(prompt);
    const text   = result.response.text();
    const parsed = this._parseGeminiResponse(text);
    return {
      ...parsed,
      engineVersion:      this.engineVersion,
      inferenceLatencyMs: Date.now() - startTs,
      fallbackUsed:       true,
      scorer_used:        'gemini_fallback',
    };
  }

  _buildGeminiPrompt(features) {
    return `You are a clinical voice biomarker analysis engine calibrated for Indian voices.
Analyze ONLY the acoustic feature vector below and return a JSON response.

Acoustic Feature Vector:
${JSON.stringify(features, null, 2)}

IMPORTANT CALIBRATION NOTES FOR INDIAN VOICES:
- Normal Indian F0 range: 165–185 Hz (not 120–160 Hz as in Western norms)
- Normal Indian speech rate: 4.2–5.2 syllables/sec (faster than Western 3.5–4.0)
- Pause ratios up to 0.30 are normal in Indian speech (cultural deference pauses)
- Tamil/Telugu speakers: F0 variation is linguistic, NOT always emotional marker
- Jitter up to 0.025 is normal for Indian voices (+15% vs Western)
- Consider blue-collar context: higher HNR degradation due to noisy environments

Respond ONLY with valid JSON (no additional text):
{
  "depression_score": <0-100>,
  "anxiety_score": <0-100>,
  "stress_score": <0-100>,
  "emotional_stability_score": <0-100>,
  "confidence_score": <0-100>,
  "biomarker_findings": {
    "pitch":            { "finding": "<string>", "severity": "<low|moderate|high>" },
    "speech_rate":      { "finding": "<string>", "severity": "<low|moderate|high>" },
    "vocal_quality":    { "finding": "<string>", "severity": "<low|moderate|high>" },
    "energy_level":     { "finding": "<string>", "severity": "<low|moderate|high>" },
    "rhythm_stability": { "finding": "<string>", "severity": "<low|moderate|high>" }
  },
  "clinical_flags": ["<flag if concerning>"],
  "recommended_followup_weeks": <1-12>,
  "alert_trigger": <boolean>,
  "overall_risk_level": "<low|moderate|high|critical>",
  "confidence": <0-100>
}`;
  }

  _parseGeminiResponse(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');
    const p = JSON.parse(jsonMatch[0]);

    const required = [
      'depression_score','anxiety_score','stress_score',
      'emotional_stability_score','confidence_score',
      'biomarker_findings','clinical_flags',
      'recommended_followup_weeks','alert_trigger','overall_risk_level',
    ];
    for (const f of required) {
      if (!(f in p)) throw new Error(`Missing field: ${f}`);
    }

    return {
      depression_score:          Math.min(100, Math.max(0, p.depression_score)),
      anxiety_score:             Math.min(100, Math.max(0, p.anxiety_score)),
      stress_score:              Math.min(100, Math.max(0, p.stress_score)),
      emotional_stability_score: Math.min(100, Math.max(0, p.emotional_stability_score)),
      confidence_score:          Math.min(100, Math.max(0, p.confidence_score)),
      biomarker_findings:        p.biomarker_findings,
      clinical_flags:            p.clinical_flags || [],
      recommended_followup_weeks:Math.max(1, p.recommended_followup_weeks),
      alert_trigger:             Boolean(p.alert_trigger),
      overall_risk_level:        p.overall_risk_level,
      confidence:                Math.min(100, Math.max(0, p.confidence || 72)),
    };
  }

  // ── Deterministic fallback ────────────────────────────────────────────────

  _deterministicFallback(features, latencyMs) {
    const f = features || {};
    let dep = 38, anx = 33, str = 35;

    // Indian-calibrated rules
    const f0 = f.f0_mean || 174;
    if (f0 < 120) dep = Math.min(80, dep + 35);
    else if (f0 < 140) dep = Math.min(65, dep + 18);

    const sr = f.speech_rate || 4.4;
    if (sr < 2.8) dep = Math.min(80, dep + 30);
    else if (sr > 5.5) { anx = Math.min(75, anx + 20); str = Math.min(75, str + 15); }

    const pause = f.pause_ratio || 0;
    if (pause > 0.45) dep = Math.min(80, dep + 25);   // only flag if very high (Indian norm ≤ 0.30)

    const energy = f.energy_mean || 0.05;
    if (energy < 0.025) dep = Math.min(85, dep + 20);
    else if (energy > 0.085) str = Math.min(75, str + 20);

    const jitter = f.jitter || 0;
    if (jitter > 0.040) anx = Math.min(75, anx + 22);

    const riskLevel = _riskLevel(dep, anx, str);
    const stability = Math.max(15, 100 - Math.max(dep, anx, str));

    return {
      depression_score:          Math.round(dep),
      anxiety_score:             Math.round(anx),
      stress_score:              Math.round(str),
      emotional_stability_score: Math.round(stability),
      confidence_score:          45,
      biomarker_findings:        _biomarkerFindings(f, {}),
      clinical_flags:            _clinicalFlags(dep, anx, str, f),
      recommended_followup_weeks:_followupWeeks(riskLevel),
      alert_trigger:             riskLevel === 'high' || riskLevel === 'critical',
      overall_risk_level:        riskLevel,
      confidence:                45,
      scorer_used:               'deterministic_fallback',
      engineVersion:             this.engineVersion,
      inferenceLatencyMs:        latencyMs,
      fallbackUsed:              true,
    };
  }
}

module.exports = new VocaCoreEngine();
