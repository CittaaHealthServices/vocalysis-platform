const Tenant = require('./Tenant.model');
const User = require('./User.model');
const Employee = require('./Employee.model');
const Session = require('./Session.model');
const Alert = require('./Alert.model');
const ApiKey = require('./ApiKey.model');
const AuditLog = require('./AuditLog.model');
const HealthCheckLog = require('./HealthCheckLog.model');
const WebhookDeliveryLog = require('./WebhookDeliveryLog.model');
const Consultation = require('./Consultation.model');

module.exports = {
  Tenant,
  User,
  Employee,
  Session,
  Alert,
  ApiKey,
  AuditLog,
  HealthCheckLog,
  WebhookDeliveryLog,
  Consultation,
};
