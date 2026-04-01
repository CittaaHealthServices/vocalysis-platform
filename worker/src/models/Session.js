const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // ✅ Fix: API stores these as plain strings (UUID / "cittaa-3z0z"), not ObjectIds
  tenantId: { type: String, required: true },
  patientId: { type: String },
  clinicianId: { type: String },
  employeeId: { type: String },
  // status field kept flexible so the worker can mark sessions failed
  status: { type: String },
  audioDeletedAt: Date,
  audioDeleteConfirmed: { type: Boolean, default: false },
  analysisResults: mongoose.Schema.Types.Mixed,
  analysisStatus: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'] },
  analyzedAt: Date,
  reportPdfKey: String,
  reportStatus: { type: String, enum: ['pending', 'generating', 'finalised', 'failed'] },
  reportGeneratedAt: Date,
  reportGeneratedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // ✅ Fix: fields populated by audioAnalysis.js worker — must be declared or Mongoose drops them
  vocacoreResults: mongoose.Schema.Types.Mixed,
  employeeWellnessOutput: {
    wellnessScore:               { type: Number },
    wellnessLevel:               { type: String },
    personalizedRecommendations: [String],
    actionItems:                 [String],
    resourcesRecommended:        [String],
    selfHelpMaterials:           [String],
  },
  audioFeatures: mongoose.Schema.Types.Mixed,
  audioMetadata: mongoose.Schema.Types.Mixed,
}, { strict: false }); // allow extra ad-hoc fields written by worker without schema collision

sessionSchema.index({ tenantId: 1, createdAt: -1 });
sessionSchema.index({ patientId: 1 });
sessionSchema.index({ clinicianId: 1 });

module.exports = mongoose.model('Session', sessionSchema);
