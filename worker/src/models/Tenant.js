const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  tenantName: { type: String, required: true },
  usedAssessmentCount: { type: Number, default: 0 },
  lastAssessmentDate: Date,
  webhookConfig: {
    url: String,
    secret: String,
    enabled: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

tenantSchema.index({ tenantName: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
