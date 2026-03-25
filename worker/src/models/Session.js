const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
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
