const Alert = require('../models/Alert');
const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('./emailService');

class AlertEngine {
  constructor() {
    // Alert severity thresholds
    this.thresholds = {
      depression: {
        high: 70,
        critical: 85
      },
      anxiety: {
        high: 65,
        critical: 80
      },
      stress: {
        high: 75,
        critical: 85
      }
    };
  }

  /**
   * Evaluate session results and create alerts if thresholds breached
   */
  async evaluateSession(session, tenant) {
    if (!session.vocacoreResults) {
      return {
        alertCreated: false,
        alertId: null,
        alertLevel: null
      };
    }

    const results = session.vocacoreResults;
    let alertLevel = null;
    let triggeringScores = [];

    // Check depression threshold
    if (results.depression_score >= this.thresholds.depression.critical) {
      alertLevel = 'critical';
      triggeringScores.push(`Depression: ${results.depression_score}`);
    } else if (results.depression_score >= this.thresholds.depression.high) {
      if (!alertLevel || alertLevel !== 'critical') {
        alertLevel = 'high';
      }
      triggeringScores.push(`Depression: ${results.depression_score}`);
    }

    // Check anxiety threshold
    if (results.anxiety_score >= this.thresholds.anxiety.critical) {
      alertLevel = 'critical';
      triggeringScores.push(`Anxiety: ${results.anxiety_score}`);
    } else if (results.anxiety_score >= this.thresholds.anxiety.high) {
      if (!alertLevel || alertLevel !== 'critical') {
        alertLevel = 'high';
      }
      triggeringScores.push(`Anxiety: ${results.anxiety_score}`);
    }

    // Check stress threshold
    if (results.stress_score >= this.thresholds.stress.critical) {
      alertLevel = 'critical';
      triggeringScores.push(`Stress: ${results.stress_score}`);
    } else if (results.stress_score >= this.thresholds.stress.high) {
      if (!alertLevel || alertLevel !== 'critical') {
        alertLevel = 'high';
      }
      triggeringScores.push(`Stress: ${results.stress_score}`);
    }

    // If no threshold breached, return no alert
    if (!alertLevel) {
      return {
        alertCreated: false,
        alertId: null,
        alertLevel: null
      };
    }

    // Create alert document
    const alert = new Alert({
      tenantId: tenant.tenantId,
      employeeId: session.employeeId,
      sessionId: String(session._id),
      alertLevel,
      triggeringScores,
      alertType: alertLevel === 'critical' ? 'crisis_alert' : 'high_risk_detected',
      severity: alertLevel,
      status: 'active',
      title: `${alertLevel === 'critical' ? 'Critical' : 'High'} wellness risk detected`,
      message: `Thresholds breached for ${triggeringScores.join(', ')}`,
      createdAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      escalatedAt: null,
      escalatedTo: null,
      escalationReason: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionSummary: null
    });

    await alert.save();

    // Log alert creation
    logger.info('Alert created', {
      alertId: alert._id,
      tenantId: tenant.tenantId,
      employeeId: session.employeeId,
      alertLevel,
      triggeringScores
    });

    return {
      alertCreated: true,
      alertId: alert._id,
      alertLevel
    };
  }

  /**
   * Get active alerts with pagination and filtering
   */
  async getActiveAlerts(tenantId, filters = {}) {
    try {
      const query = {
        tenantId,
        status: 'active'
      };

      if (filters.alertLevel) {
        query.alertLevel = filters.alertLevel;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.employeeId) {
        query.employeeId = filters.employeeId;
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [alerts, total] = await Promise.all([
        Alert.find(query)
          .populate('employeeId', 'firstName lastName email')
          .populate('sessionId', 'createdAt vocacoreResults')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Alert.countDocuments(query)
      ]);

      return {
        alerts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      logger.error('Failed to fetch active alerts', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to fetch alerts');
    }
  }

  /**
   * Acknowledge alert by user
   */
  async acknowledgeAlert(alertId, userId, note = null) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
          acknowledgementNote: note
        },
        { new: true }
      ).populate('employeeId');

      logger.info('Alert acknowledged', {
        alertId,
        acknowledgedBy: userId
      });

      return alert;
    } catch (err) {
      logger.error('Failed to acknowledge alert', {
        error: err.message,
        alertId
      });
      throw new Error('Failed to acknowledge alert');
    }
  }

  /**
   * Escalate alert to higher authority
   */
  async escalateAlert(alertId, escalatedTo, reason) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          status: 'escalated',
          escalatedAt: new Date(),
          escalatedTo,
          escalationReason: reason
        },
        { new: true }
      ).populate('employeeId');

      // Send escalation notification email
      const escalatedToUser = await User.findById(escalatedTo);
      if (escalatedToUser && escalatedToUser.email) {
        await emailService.sendAlertEscalationNotification({
          to: escalatedToUser.email,
          alert,
          employee: alert.employeeId,
          reason
        }).catch(err => {
          logger.error('Failed to send escalation notification', {
            error: err.message,
            alertId
          });
        });
      }

      logger.info('Alert escalated', {
        alertId,
        escalatedTo,
        reason
      });

      return alert;
    } catch (err) {
      logger.error('Failed to escalate alert', {
        error: err.message,
        alertId
      });
      throw new Error('Failed to escalate alert');
    }
  }

  /**
   * Resolve alert with resolution summary
   */
  async resolveAlert(alertId, resolvedBy, resolutionSummary) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy,
          resolutionSummary
        },
        { new: true }
      ).populate('employeeId');

      logger.info('Alert resolved', {
        alertId,
        resolvedBy
      });

      return alert;
    } catch (err) {
      logger.error('Failed to resolve alert', {
        error: err.message,
        alertId
      });
      throw new Error('Failed to resolve alert');
    }
  }

  /**
   * Get alert statistics for dashboard
   */
  async getAlertStats(tenantId) {
    try {
      const stats = await Alert.aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const levelStats = await Alert.aggregate([
        { $match: { tenantId, status: 'active' } },
        {
          $group: {
            _id: '$alertLevel',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        byStatus: {
          active: 0,
          acknowledged: 0,
          escalated: 0,
          resolved: 0
        },
        byLevel: {
          high: 0,
          critical: 0
        }
      };

      stats.forEach(s => {
        if (result.byStatus.hasOwnProperty(s._id)) {
          result.byStatus[s._id] = s.count;
        }
      });

      levelStats.forEach(s => {
        if (result.byLevel.hasOwnProperty(s._id)) {
          result.byLevel[s._id] = s.count;
        }
      });

      return result;
    } catch (err) {
      logger.error('Failed to get alert statistics', {
        error: err.message,
        tenantId
      });
      throw new Error('Failed to fetch alert statistics');
    }
  }
}

module.exports = new AlertEngine();
