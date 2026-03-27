const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // ✅ Fix: API stores these as plain strings (UUID / "cittaa-3z0z"), not ObjectIds
  tenantId: { type: String, required: true },
  patientId: { type: String },
  clinicianId: { type: String },
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
  updatedAt: { type: Date, default: Date.now }
});

sessionSchema.index({ tenantId: 1, createdAt: -1 });
sessionSchema.index({ patientId: 1 });
sessionSchema.index({ clinicianId: 1 });

module.exports = mongoose.model('Session', sessionSchema);
