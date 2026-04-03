const { v4: uuidv4 } = require('uuid');
const AuditLog = require('../models/AuditLog.model');
const logger = require('../config/logger');

const auditLog = (action, targetResource = null) => {
  return async (req, res, next) => {
    const requestId = req.id || uuidv4();
    req.id = requestId;

    const originalSend = res.send;

    res.send = function (data) {
      res.send = originalSend;

      setImmediate(async () => {
        try {
          const logEntry = {
            userId: req.user?.userId || 'anonymous',
            tenantId: req.user?.tenantId || req.apiKey?.tenantId || 'unknown',
            role: req.user?.role,
            action,
            targetResource: targetResource || req.params?.resource,
            targetResourceId: req.params?.id,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            requestId,
            statusCode: res.statusCode,
            outcome: res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure',
            timestamp: new Date(),
          };

          if (res.statusCode >= 400) {
            try {
              const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
              if (parsedData?.message) {
                logEntry.errorMessage = parsedData.message;
              }
              if (parsedData?.code) {
                logEntry.errorCode = parsedData.code;
              }
            } catch (e) {
              logEntry.errorMessage = data?.toString()?.substring(0, 200);
            }
          }

          if (req.user) {
            logEntry.additionalContext = {
              deviceType: req.get('device-type'),
              browserName: extractBrowserName(req.get('user-agent')),
              operatingSystem: extractOS(req.get('user-agent')),
            };
          }

          if (req.apiKey?.keyId) {
            logEntry.additionalContext = {
              ...(logEntry.additionalContext || {}),
              apiKeyId: req.apiKey.keyId,
            };
          }

          await AuditLog.create(logEntry);

          logger.info(`Audit: ${action}`, {
            requestId,
            tenantId: logEntry.tenantId,
            userId: logEntry.userId,
            statusCode: logEntry.statusCode,
          });
        } catch (error) {
          logger.error('Failed to create audit log', {
            error: error.message,
            action,
            requestId,
          });
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };
};

const extractBrowserName = (userAgent) => {
  if (!userAgent) return null;

  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';

  return null;
};

const extractOS = (userAgent) => {
  if (!userAgent) return null;

  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';

  return null;
};

module.exports = {
  auditLog,
};
