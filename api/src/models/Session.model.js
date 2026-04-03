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
      ref: 'User',
      index: true,
    },
    employeeId: {
      type: String,
      ref: 'User',
    },
    clinicianId: {
      type: String,
      ref: 'User',
    },
    createdBy: {
      type: String,
      ref: 'User',
    },
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
    audioFileName: String,
    audioMimeType: String,
    audioFileSize: Number,
    notes: String,
    errorMessage: String,
    completedAt: Date,
    clinicianNotes: String,
    reportGenerated: {
      type: Boolean,
      default: false,
    },
    reportGeneratedAt: Date,
    deletedAt: Date,
    deletedBy: String,
    deletionReason: String,
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
    vocacoreResults: {
      depression_score: Number,
      anxiety_score: Number,
      stress_score: Number,
      emotional_stability_score: Number,
      confidence_score: Number,
      recommended_followup_weeks: Number,
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
        anxiety: Number,
        stress: Number,
        burnout: Number,
        engagement: Number,
      },
      keyIndicators: [String],
      clinicalRecommendations: [String],
      algorithmVersion: String,
      processedAt: Date,
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
      overallScore: Number,
      stressLevel: String,
      recommendedActions: [String],
      nextCheckupDays: Number,
      generatedAt: Date,
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
      enum: ['draft', 'submitted', 'reviewed', 'archived', 'processing', 'completed', 'failed', 'finalised'],
      default: 'draft',
    },
    consentVerified: Boolean,
    isAnonymized: Boolean,
    privacyFlags: [String],
    dataRetentionUntil: Date,
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ tenantId: 1, sessionDate: -1 });
sessionSchema.index({ tenantId: 1, patientId: 1, sessionDate: -1 });
sessionSchema.index({ tenantId: 1, 'vocacoreResults.overallRiskLevel': 1 });

module.exports = mongoose.model('Session', sessionSchema);
