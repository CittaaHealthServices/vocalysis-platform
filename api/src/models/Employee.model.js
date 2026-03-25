const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const employeeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: String,
    departmentId: {
      type: String,
      required: true,
      index: true,
    },
    jobTitle: String,
    grade: String,
    location: String,
    managerId: String,
    dateOfJoining: Date,
    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave', 'offboarded'],
      default: 'active',
      index: true,
    },
    offboardedAt: Date,
    offboardReason: String,
    wellnessProfile: {
      enrolledAt: Date,
      lastAssessmentDate: Date,
      totalAssessments: {
        type: Number,
        default: 0,
      },
      currentRiskLevel: {
        type: String,
        enum: ['green', 'yellow', 'orange', 'red', 'unknown'],
        default: 'unknown',
      },
      riskTrend: {
        type: String,
        enum: ['improving', 'stable', 'declining', 'unknown'],
        default: 'unknown',
      },
      consentActive: {
        type: Boolean,
        default: false,
      },
    },
    assessmentSchedule: {
      frequency: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
      },
      nextScheduledDate: Date,
      reminderSentAt: Date,
      autoReminderEnabled: {
        type: Boolean,
        default: false,
      },
    },
    importBatchId: String,
    importedAt: Date,
    importSource: String,
    addedBy: String,
    updatedBy: String,
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ tenantId: 1, departmentId: 1 });
employeeSchema.index({ tenantId: 1, status: 1 });
employeeSchema.index({ tenantId: 1, userId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ tenantId: 1, email: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
