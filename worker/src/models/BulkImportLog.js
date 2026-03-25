const mongoose = require('mongoose');

const bulkImportLogSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  tenantId: mongoose.Schema.Types.ObjectId,
  total: Number,
  inserted: Number,
  skipped: Number,
  failed: Number,
  errorCount: Number,
  addedBy: String,
  completedAt: Date,
  status: { type: String, enum: ['in-progress', 'completed', 'completed_with_errors', 'failed'] },
  createdAt: { type: Date, default: Date.now }
});

bulkImportLogSchema.index({ tenantId: 1, completedAt: -1 });
bulkImportLogSchema.index({ batchId: 1 });

module.exports = mongoose.model('BulkImportLog', bulkImportLogSchema);
