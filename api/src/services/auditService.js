const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class AuditService {
  /**
   * Log an audit event
   */
  async log({
    userId,
    tenantId,
    role,
    action,
    targetResource,
    targetId,
    ipAddress,
    userAgent,
    requestId,
    changeSnapshot = null,
    outcome = 'success',
    errorMessage = null
  }) {
    try {
      const auditLog = new AuditLog({
        userId,
        tenantId,
        role,
        action,
        targetResource,
        targetId,
        ipAddress,
        userAgent,
        requestId,
        changeSnapshot,
        outcome,
        errorMessage,
        timestamp: new Date()
      });

      await auditLog.save();

      logger.debug('Audit log recorded', {
        action,
        targetResource,
        outcome,
        userId
      });

      return auditLog;
    } catch (err) {
      logger.error('Failed to record audit log', {
        error: err.message,
        action
      });
      // Don't throw - audit failures shouldn't break the application
    }
  }

  /**
   * Query audit logs with pagination and filtering
   */
  async query({
    tenantId,
    userId = null,
    action = null,
    targetResource = null,
    outcome = null,
    from = null,
    to = null,
    page = 1,
    limit = 50
  }) {
    try {
      const query = { tenantId };

      if (userId) {
        query.userId = userId;
      }

      if (action) {
        query.action = action;
      }

      if (targetResource) {
        query.targetResource = targetResource;
      }

      if (outcome) {
        query.outcome = outcome;
      }

      if (from || to) {
        query.timestamp = {};
        if (from) {
          query.timestamp.$gte = new Date(from);
        }
        if (to) {
          query.timestamp.$lte = new Date(to);
        }
      }

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      logger.error('Failed to query audit logs', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserActivity(userId, tenantId, limit = 100) {
    try {
      const logs = await AuditLog.find({ userId, tenantId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (err) {
      logger.error('Failed to get user activity', {
        error: err.message,
        userId
      });
      throw new Error('Failed to retrieve user activity');
    }
  }

  /**
   * Get activity summary for a time period
   */
  async getActivitySummary(tenantId, days = 7) {
    try {
      const from = new Date();
      from.setDate(from.getDate() - days);

      const summary = await AuditLog.aggregate([
        {
          $match: {
            tenantId,
            timestamp: { $gte: from }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return summary;
    } catch (err) {
      logger.error('Failed to get activity summary', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to retrieve activity summary');
    }
  }

  /**
   * Get suspicious activity patterns
   */
  async getSuspiciousActivity(tenantId) {
    try {
      // Failed login attempts in last hour
      const failedLogins = await AuditLog.countDocuments({
        tenantId,
        action: 'LOGIN_ATTEMPT',
        outcome: 'failure',
        timestamp: {
          $gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      });

      // Multiple failed attempts from same user
      const suspiciousUsers = await AuditLog.aggregate([
        {
          $match: {
            tenantId,
            action: 'LOGIN_ATTEMPT',
            outcome: 'failure',
            timestamp: {
              $gte: new Date(Date.now() - 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gte: 3 }
          }
        }
      ]);

      // Unauthorized access attempts
      const unauthorizedAttempts = await AuditLog.countDocuments({
        tenantId,
        outcome: 'failure',
        timestamp: {
          $gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      });

      return {
        failedLoginAttempts: failedLogins,
        suspiciousUsers: suspiciousUsers.map(u => ({
          userId: u._id,
          failedAttempts: u.count
        })),
        unauthorizedAccessAttempts: unauthorizedAttempts
      };
    } catch (err) {
      logger.error('Failed to detect suspicious activity', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to check suspicious activity');
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(tenantId, format = 'json', filters = {}) {
    try {
      const query = { tenantId, ...filters };
      const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();

      if (format === 'csv') {
        return this._convertToCSV(logs);
      }

      return logs; // JSON format
    } catch (err) {
      logger.error('Failed to export audit logs', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Convert logs to CSV format
   */
  _convertToCSV(logs) {
    const headers = [
      'Timestamp',
      'User ID',
      'Role',
      'Action',
      'Target Resource',
      'Target ID',
      'IP Address',
      'Outcome',
      'Error Message'
    ];

    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.userId,
      log.role,
      log.action,
      log.targetResource,
      log.targetId,
      log.ipAddress,
      log.outcome,
      log.errorMessage || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csv;
  }
}

module.exports = new AuditService();
