const mongoose = require('mongoose');

// Session Model
const sessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  audioDeletedAt: Date,
  audioDeleteConfirmed: { type: Boolean, default: false },
  analysisResults: mongoose.Schema.Types.Mixed,
  analysisStatus: String,
  analyzedAt: Date,
  reportPdfKey: String,
  reportStatus: String,
  reportGeneratedAt: Date,
  reportGeneratedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

const Session = mongoose.model('Session', sessionSchema);

// Employee Model
const employeeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employeeId: String,
  fullName: String,
  email: String,
  departmentId: String,
  jobTitle: String,
  role: String,
  status: String,
  dateOfJoining: Date,
  specialization: String,
  managedDepartments: [String],
  phone: String,
  gender: String,
  location: String,
  dateOfBirth: Date,
  assessmentSchedule: {
    nextScheduledDate: Date,
    frequency: String,
    autoReminderEnabled: Boolean,
    lastReminderSentAt: Date
  },
  wellnessProfile: {
    consentActive: Boolean,
    currentRiskLevel: String,
    lastAssessmentDate: Date,
    totalAssessments: Number,
    riskHistory: [mongoose.Schema.Types.Mixed]
  },
  remindersSent: [mongoose.Schema.Types.Mixed],
  importBatchId: String,
  addedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

const Employee = mongoose.model('Employee', employeeSchema);

// Tenant Model
const tenantSchema = new mongoose.Schema({
  tenantName: String,
  usedAssessmentCount: { type: Number, default: 0 },
  lastAssessmentDate: Date,
  webhookConfig: {
    url: String,
    secret: String,
    enabled: Boolean
  },
  createdAt: { type: Date, default: Date.now }
});

const Tenant = mongoose.model('Tenant', tenantSchema);

// Alert Model
const alertSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employeeId: mongoose.Schema.Types.ObjectId,
  sessionId: mongoose.Schema.Types.ObjectId,
  employeeName: String,
  type: String,
  severity: String,
  message: String,
  analysisResult: mongoose.Schema.Types.Mixed,
  triggeredAt: { type: Date, default: Date.now },
  escalatedAt: Date,
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

const Alert = mongoose.model('Alert', alertSchema);

// WebhookDeliveryLog Model
const webhookDeliveryLogSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  event: String,
  webhookUrl: String,
  attempt: Number,
  status: String,
  statusCode: Number,
  responseTime: Number,
  signature: String,
  error: String,
  finalStatus: String,
  timestamp: { type: Date, default: Date.now }
});

const WebhookDeliveryLog = mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema);

// BulkImportLog Model
const bulkImportLogSchema = new mongoose.Schema({
  batchId: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  total: Number,
  inserted: Number,
  skipped: Number,
  failed: Number,
  errorCount: Number,
  addedBy: String,
  completedAt: Date,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

const BulkImportLog = mongoose.model('BulkImportLog', bulkImportLogSchema);

// AuditLog Model
const auditLogSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  action: String,
  resourceType: String,
  resourceId: mongoose.Schema.Types.ObjectId,
  severity: String,
  details: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Consultation Model
const consultationSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  tenantId: mongoose.Schema.Types.ObjectId,
  status: String,
  scheduledAt: Date,
  duration: Number,
  remindersSent: [mongoose.Schema.Types.Mixed],
  createdAt: { type: Date, default: Date.now }
});

const Consultation = mongoose.model('Consultation', consultationSchema);

module.exports = {
  Session,
  Employee,
  Tenant,
  Alert,
  WebhookDeliveryLog,
  BulkImportLog,
  AuditLog,
  Consultation
};
