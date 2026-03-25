const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const auditLogSchema = new mongoose.Schema(
  {
    auditLogId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    role: String,
    action: {
      type: String,
      required: true,
      enum: [
        'USER_LOGIN',
        'USER_LOGOUT',
        'USER_CREATE',
        'USER_UPDATE',
        'USER_DELETE',
        'USER_VERIFY_EMAIL',
        'USER_RESET_PASSWORD',
        'USER_ENABLE_MFA',
        'USER_DISABLE_MFA',
        'SESSION_UPLOAD',
        'SESSION_VIEW',
        'SESSION_DELETE',
        'ASSESSMENT_CREATE',
        'ASSESSMENT_COMPLETE',
        'ALERT_CREATE',
        'ALERT_ACKNOWLEDGE',
        'ALERT_RESOLVE',
        'CONSULTATION_SCHEDULE',
        'CONSULTATION_CANCEL',
        'CONSULTATION_COMPLETE',
        'EMPLOYEE_IMPORT',
        'EMPLOYEE_CREATE',
        'EMPLOYEE_UPDATE',
        'EMPLOYEE_DELETE',
        'TENANT_UPDATE',
        'TENANT_SUSPEND',
        'TENANT_REACTIVATE',
        'API_KEY_CREATE',
        'API_KEY_REVOKE',
        'WEBHOOK_TRIGGER',
        'DATA_EXPORT',
        'REPORT_GENERATE',
        'CONSENT_GRANT',
        'CONSENT_WITHDRAW',
        'INTEGRATION_CONNECT',
        'INTEGRATION_DISCONNECT',
        'MFA_CODE_VERIFY',
        'RATE_LIMIT_EXCEEDED',
        'PERMISSION_DENIED',
        'RESOURCE_NOT_FOUND',
        'VALIDATION_FAILED',
        'EXTERNAL_API_CALL',
      ],
      required: true,
      index: true,
    },
    targetResource: {
      type: String,
      enum: [
        'user',
        'session',
        'assessment',
        'alert',
        'employee',
        'tenant',
        'apikey',
        'webhook',
        'consultation',
        'consent',
        'department',
        'integration',
      ],
    },
    targetResourceId: String,
    ipAddress: String,
    userAgent: String,
    requestId: String,
    outcome: {
      type: String,
      enum: ['success', 'failure', 'partial'],
      default: 'success',
    },
    statusCode: Number,
    errorMessage: String,
    changeSnapshot: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      changedFields: [String],
    },
    additionalContext: {
      deviceType: String,
      browserName: String,
      operatingSystem: String,
      apiKeyId: String,
      apiVersion: String,
      requestDuration: Number,
      requestSize: Number,
      responseSize: Number,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetResource: 1, targetResourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
