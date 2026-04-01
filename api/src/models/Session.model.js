const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    employeeId: String,
    clinicianId: String,
    departmentId: String,
    sessionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    duration: {
      totalSeconds: Number,
      recordingSeconds: Number,
    },
    language: {
      iso639_1: String,
      name: String,
    },
    sessionType: {
      type: String,
      enum: ['baseline', 'periodic', 'followup', 'diagnostic', 'crisis'],
    },
    audioMetadata: {
      fileName: String,
      mimeType: String,
      sizeBytes: Number,
      uploadedAt: Date,
      processingStartedAt: Date,
      processingCompletedAt: Date,
      processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      vocowareJobId: String,
      storageLocation: String,
    },
    extractedFeatures: {
      prosody: {
        fundamentalFrequency: {
          mean: Number,
          std: Number,
          min: Number,
          max: Number,
        },
        intensity: {
          mean: Number,
          std: Number,
        },
        speechRate: {
          wordsPerMinute: Number,
          pauseFrequency: Number,
        },
      },
      voice: {
        shimmer: Number,
        jitter: Number,
        nhr: Number,
        hnr: Number,
        spectralCentroid: Number,
        spectrogram: String,
      },
      acoustic: {
        mfccMean: [Number],
        mfccVariance: [Number],
        zerocrossingRate: {
          mean: Number,
          std: Number,
        },
        energy: {
          mean: Number,
          std: Number,
        },
      },
      linguistic: {
        wordCount: Number,
        uniqueWordCount: Number,
        averageWordLength: Number,
        sentimentScore: {
          compound: Number,
          positive: Number,
          neutral: Number,
          negative: Number,
        },
        lexicalDiversity: Number,
        topicsDetected: [String],
      },
      temporal: {
        speechDuration: Number,
        pauseDuration: Number,
        speechPausesRatio: Number,
        utteranceDuration: {
          mean: Number,
          std: Number,
        },
      },
      timestamps: Date,
    },
    // Analysis lifecycle fields (written by worker, read by API + frontend)
    analysisStatus: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'failed'],
      default: 'pending',
    },
    analyzedAt: Date,
    analysisResults: { type: mongoose.Schema.Types.Mixed }, // legacy field

    vocacoreResults: {
      overallRiskLevel: {
        type: String,
        enum: ['green', 'yellow', 'orange', 'red'],
        index: true,
      },
      riskScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
      },
      dimensionalScores: {
        depression: Number,
        anxiety:    Number,
        stress:     Number,
        burnout:    Number,
        engagement: Number,
      },
      // Biomarker findings — 5 acoustic dimensions with clinical interpretation
      // Written by worker audioAnalysis.js, returned to employee-facing UI
      biomarkerFindings: {
        pitch: {
          finding:  String,
          severity: { type: String, enum: ['low', 'moderate', 'high'] },
          value:    Number,
          unit:     String,
          norm:     String,
        },
        speech_rate: {
          finding:  String,
          severity: { type: String, enum: ['low', 'moderate', 'high'] },
          value:    Number,
          unit:     String,
          norm:     String,
        },
        vocal_quality: {
          finding:  String,
          severity: { type: String, enum: ['low', 'moderate', 'high'] },
          value:    Number,
          unit:     String,
          norm:     String,
        },
        energy_level: {
          finding:  String,
          severity: { type: String, enum: ['low', 'moderate', 'high'] },
          value:    Number,
          unit:     String,
          norm:     String,
        },
        rhythm_stability: {
          finding:  String,
          severity: { type: String, enum: ['low', 'moderate', 'high'] },
          value:    Number,
          unit:     String,
          norm:     String,
        },
      },
      keyIndicators:           [String],
      clinicalRecommendations: [String],
      algorithmVersion:        String,
      engineVersion:           String,  // e.g. 'VocoCore™ 2.1-India'
      processedAt:             Date,
    },
    clinicianInputs: {
      clinicianNotes: String,
      observedBehaviors: [String],
      diagnosticImpressions: [String],
      recommendedInterventions: [String],
      followUpRequired: Boolean,
      followUpDate: Date,
      followUpReason: String,
      clinicianConfidence: {
        type: Number,
        min: 0,
        max: 100,
      },
      diagnosisIfAny: String,
      treatmentPlanId: String,
      inputProvidedAt: Date,
      inputProvidedBy: String,
    },
    employeeWellnessOutput: {
      wellnessScore: Number,
      wellnessLevel: {
        type: String,
        enum: ['thriving', 'healthy', 'at_risk', 'in_crisis'],
      },
      personalizedRecommendations: [String],
      actionItems: [String],
      resourcesRecommended: [String],
      nextCheckInDate: Date,
      selfHelpMaterials: [String],
    },
    hrAggregateContribution: {
      departmentName: String,
      riskMetrics: {
        averageRiskScore: Number,
        highRiskCount: Number,
        riskDistribution: {
          green: Number,
          yellow: Number,
          orange: Number,
          red: Number,
        },
      },
      trends: {
        week: String,
        month: String,
        quarter: String,
      },
      interventionNeeds: [String],
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'processing', 'reviewed', 'completed', 'failed', 'archived'],
      default: 'draft',
    },
    // Check-in tracking fields (set by wellness check-in flow)
    createdBy: { type: String, index: true },
    notes: String,
    audioFileName: String,
    audioMimeType: String,
    audioFileSize: Number,
    audioFeatures: { type: mongoose.Schema.Types.Mixed },
    // Daily check-in metadata
    checkInIndex: { type: Number, default: 1 }, // 1-12 within the day
    checkInDate: { type: String, index: true },  // YYYY-MM-DD for fast daily count queries
    reviewedBy: String,
    consentVerified: Boolean,
    isAnonymized: Boolean,
    privacyFlags: [String],
    dataRetentionUntil: Date,

    // ── Pre-session form (filled before the therapy session) ──
    preSessionForm: {
      currentMoodScore:   Number,
      currentStressLevel: Number,
      sleepQuality:       String,
      sleepHours:         Number,
      energyLevel:        Number,
      anxietyLevel:       Number,
      mainConcern:        String,
      recentLifeEvents:   String,
      medicationChanges:  String,
      physicalSymptoms:   String,
      suicidalIdeation:   { type: Boolean, default: false },
      sessionGoal:        String,
      safetyCheck:        { type: String, default: 'safe' },
      submittedAt:        Date,
    },

    // ── Post-session form (filled after the therapy session) ──
    postSessionForm: {
      sessionType:          String,
      sessionDuration:      Number,
      presentingIssues:     String,
      therapeuticApproach:  String,
      patientEngagement:    String,
      progressNotes:        String,
      clinicalObservations: String,
      riskAssessment:       String,
      riskLevel:            { type: String, default: 'low' },
      safetyPlan:           String,
      diagnosisCodes:       String,
      treatmentGoals:       String,
      nextSteps:            String,
      followUpRequired:     { type: Boolean, default: false },
      followUpTimeframe:    String,
      referralNeeded:       { type: Boolean, default: false },
      sessionRating:        String,
      clinicianNotes:       String,
      postMoodScore:        Number,
      postStressLevel:      Number,
      sessionHelpfulness:   String,
      patientFeedback:      String,
      submittedAt:          Date,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ tenantId: 1, sessionDate: -1 });
sessionSchema.index({ tenantId: 1, patientId: 1, sessionDate: -1 });
sessionSchema.index({ tenantId: 1, 'vocacoreResults.overallRiskLevel': 1 });

module.exports = mongoose.model('Session', sessionSchema);
