const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employeeId: { type: String, required: true },
  fullName: String,
  email: { type: String, required: true },
  departmentId: String,
  jobTitle: String,
  role: { type: String, enum: ['EMPLOYEE', 'HR_ADMIN', 'CLINICIAN', 'SENIOR_CLINICIAN', 'COMPANY_ADMIN'] },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  dateOfJoining: Date,
  specialization: String,
  managedDepartments: [String],
  phone: String,
  gender: String,
  location: String,
  dateOfBirth: Date,
  assessmentSchedule: {
    nextScheduledDate: Date,
    frequency: { type: String, enum: ['weekly', 'fortnightly', 'monthly', 'quarterly'] },
    autoReminderEnabled: Boolean,
    lastReminderSentAt: Date
  },
  wellnessProfile: {
    consentActive: Boolean,
    currentRiskLevel: { type: String, enum: ['normal', 'low', 'medium', 'high', 'critical', 'unknown'] },
    lastAssessmentDate: Date,
    totalAssessments: { type: Number, default: 0 },
    riskHistory: [{
      level: String,
      timestamp: Date,
      sessionId: mongoose.Schema.Types.ObjectId,
      confidence: Number
    }]
  },
  remindersSent: [{
    type: String,
    sentAt: Date
  }],
  importBatchId: String,
  addedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

employeeSchema.index({ tenantId: 1, email: 1 }, { unique: true });
employeeSchema.index({ tenantId: 1, employeeId: 1 });
employeeSchema.index({ tenantId: 1, status: 1 });
employeeSchema.index({ role: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
