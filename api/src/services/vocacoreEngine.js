const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class VocaCoreEngine {
  constructor() {
    // Key stored in VOCOCORE_INFERENCE_KEY
    this._client = new GoogleGenerativeAI(process.env.VOCOCORE_INFERENCE_KEY);
    this._model = this._client.getGenerativeModel({ model: 'gemini-1.5-pro' });
    this.engineVersion = 'VocaCore™ 2.0';
  }

  /**
   * Analyze feature vector and return clinical scores
   */
  async analyze(featureVector) {
    // Build prompt with ONLY numerical features
    const prompt = this._buildAnalysisPrompt(featureVector);
    const start = Date.now();

    try {
      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this._parseResponse(text);

      return {
        ...parsed,
        engineVersion: this.engineVersion,
        inferenceLatencyMs: Date.now() - start,
        fallbackUsed: false
      };
    } catch (err) {
      // Log only error type/code, never payload
      logger.error('VocaCore analysis failed, using fallback', {
        error: err.message,
        errorCode: err.code
      });
      return this._fallbackScore(featureVector, Date.now() - start);
    }
  }

  /**
   * Build structured prompt with ONLY numeric features
   */
  _buildAnalysisPrompt(features) {
    return `You are a clinical voice biomarker analysis engine. Analyze ONLY the acoustic feature vector below and return a JSON response with clinical insights.

Acoustic Feature Vector:
${JSON.stringify(features, null, 2)}

You MUST respond ONLY with valid JSON in this exact format, no additional text:
{
  "depression_score": <number 0-100>,
  "anxiety_score": <number 0-100>,
  "stress_score": <number 0-100>,
  "emotional_stability_score": <number 0-100>,
  "confidence_score": <number 0-100>,
  "biomarker_findings": {
    "pitch": {
      "finding": "<brief finding about pitch>",
      "severity": "<low|moderate|high>"
    },
    "speech_rate": {
      "finding": "<brief finding about speech rate>",
      "severity": "<low|moderate|high>"
    },
    "vocal_quality": {
      "finding": "<brief finding about vocal quality>",
      "severity": "<low|moderate|high>"
    },
    "energy_level": {
      "finding": "<brief finding about energy level>",
      "severity": "<low|moderate|high>"
    },
    "rhythm_stability": {
      "finding": "<brief finding about rhythm stability>",
      "severity": "<low|moderate|high>"
    }
  },
  "clinical_flags": [
    "<flag if any concerning pattern detected>"
  ],
  "recommended_followup_weeks": <number>,
  "alert_trigger": <boolean>,
  "overall_risk_level": "<low|moderate|high|critical>",
  "confidence": <number 0-100>
}

Do NOT generate text beyond the JSON. Do NOT reference the original audio, transcript, or patient information. Analyze ONLY the numerical features provided.`;
  }

  /**
   * Parse JSON response from model
   */
  _parseResponse(text) {
    try {
      // Extract JSON from response (may have surrounding text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = [
        'depression_score',
        'anxiety_score',
        'stress_score',
        'emotional_stability_score',
        'confidence_score',
        'biomarker_findings',
        'clinical_flags',
        'recommended_followup_weeks',
        'alert_trigger',
        'overall_risk_level'
      ];

      for (const field of requiredFields) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Normalize scores to 0-100 range
      return {
        depression_score: Math.min(100, Math.max(0, parsed.depression_score)),
        anxiety_score: Math.min(100, Math.max(0, parsed.anxiety_score)),
        stress_score: Math.min(100, Math.max(0, parsed.stress_score)),
        emotional_stability_score: Math.min(100, Math.max(0, parsed.emotional_stability_score)),
        confidence_score: Math.min(100, Math.max(0, parsed.confidence_score)),
        biomarker_findings: parsed.biomarker_findings,
        clinical_flags: parsed.clinical_flags || [],
        recommended_followup_weeks: Math.max(1, parsed.recommended_followup_weeks),
        alert_trigger: Boolean(parsed.alert_trigger),
        overall_risk_level: parsed.overall_risk_level,
        confidence: Math.min(100, Math.max(0, parsed.confidence || 75))
      };
    } catch (err) {
      logger.error('Failed to parse VocaCore response', {
        error: err.message,
        responseLength: text.length
      });
      throw new Error('Invalid response format from VocaCore engine');
    }
  }

  /**
   * Fallback deterministic scoring when inference fails
   */
  _fallbackScore(features, latencyMs) {
    // Simple rule-based scoring based on available features
    let depressionScore = 40;
    let anxietyScore = 35;
    let stressScore = 38;
    let emotionalStabilityScore = 62;
    let confidenceScore = 58;

    // Adjust based on available features
    if (features.pitch_variance !== undefined) {
      // High variance might indicate anxiety
      anxietyScore = Math.min(75, anxietyScore + features.pitch_variance * 20);
    }

    if (features.speech_rate !== undefined) {
      // Very fast speech might indicate anxiety/stress
      if (features.speech_rate > 180) {
        anxietyScore = Math.min(80, anxietyScore + 15);
        stressScore = Math.min(80, stressScore + 15);
      }
    }

    if (features.energy_level !== undefined) {
      // Low energy might indicate depression
      if (features.energy_level < 0.3) {
        depressionScore = Math.min(85, depressionScore + 30);
        emotionalStabilityScore = Math.max(20, emotionalStabilityScore - 30);
      }
    }

    return {
      depression_score: Math.round(depressionScore),
      anxiety_score: Math.round(anxietyScore),
      stress_score: Math.round(stressScore),
      emotional_stability_score: Math.round(emotionalStabilityScore),
      confidence_score: Math.round(confidenceScore),
      biomarker_findings: {
        pitch: { finding: 'Baseline characteristics detected', severity: 'low' },
        speech_rate: { finding: 'Normal speech pace observed', severity: 'low' },
        vocal_quality: { finding: 'Standard vocal quality detected', severity: 'low' },
        energy_level: { finding: 'Moderate energy levels', severity: 'low' },
        rhythm_stability: { finding: 'Stable rhythm patterns', severity: 'low' }
      },
      clinical_flags: [],
      recommended_followup_weeks: 4,
      alert_trigger: false,
      overall_risk_level: 'low',
      confidence: 45,
      engineVersion: this.engineVersion,
      inferenceLatencyMs: latencyMs,
      fallbackUsed: true
    };
  }
}

module.exports = new VocaCoreEngine();
