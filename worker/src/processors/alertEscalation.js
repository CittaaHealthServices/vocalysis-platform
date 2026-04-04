const mongoose = require('mongoose');
const logger = require('../logger');

module.exports = async function alertEscalationProcessor() {
  try {
    logger.info('Starting alert escalation cron job (runs every 30 minutes)');

    const Alert = require('../models/Alert');
    const Employee = require('../models/Employee');
    const { queues } = require('../worker');

    // Find alerts with status='new' that were triggered more than 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const newAlerts = await Alert.find({
      status: 'new',
      triggeredAt: { $lt: twoHoursAgo }
    }).populate('tenantId', 'tenantName');

    logger.info('Found %d alerts to escalate', newAlerts.length);

    let escalated = 0;
    let escalationsFailed = 0;

    for (const alert of newAlerts) {
      try {
        // Use findByIdAndUpdate to skip full-document Mongoose validation.
        // Legacy alerts may have tenantId/employeeId stored as strings (not ObjectIds)
        // which would cause alert.save() to throw a cast validation error.
        await Alert.findByIdAndUpdate(alert._id, {
          status: 'escalated',
          escalatedAt: new Date(),
          updatedAt: new Date(),
        });

        // Resolve tenantId — may be a populated sub-document or a raw value
        const resolvedTenantId = alert.tenantId?._id ?? alert.tenantId;
        const tenantIdIsObjectId = mongoose.Types.ObjectId.isValid(resolvedTenantId)
          && String(new mongoose.Types.ObjectId(resolvedTenantId)) === String(resolvedTenantId);

        // Find escalation targets (Senior Clinician or Company Admin for tenant)
        const escalationTargets = tenantIdIsObjectId
          ? await Employee.find({
              tenantId: resolvedTenantId,
              role: { $in: ['SENIOR_CLINICIAN', 'COMPANY_ADMIN'] },
              status: 'active'
            })
          : [];

        logger.info('Found %d escalation targets for alert %s', escalationTargets.length, alert._id);

        // Queue email notifications for each escalation target
        for (const target of escalationTargets) {
          if (target.email) {
            await queues.emailNotifications.add(
              {
                type: 'alert_notification',
                to: target.email,
                templateData: {
                  clinicianName: target.fullName,
                  employeeName: alert.employeeName || 'Unknown Employee',
                  severity: alert.severity || 'high',
                  message: alert.message,
                  sessionId: alert.sessionId,
                  escalationReason: 'Alert triggered more than 2 hours ago - requires immediate attention',
                  timestamp: alert.triggeredAt.toLocaleString('en-IN'),
                  reviewLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/alerts/${alert._id}`
                }
              },
              { jobId: `escalation-${alert._id}-${target._id}-${Date.now()}` }
            );

            logger.debug('Escalation email queued for %s', target.fullName);
          }
        }

        // Create audit log entry — only if tenantId is a valid ObjectId,
        // otherwise AuditLog validation would throw a cast error for legacy alerts.
        if (tenantIdIsObjectId) {
          const AuditLog = require('../models/AuditLog');
          await AuditLog.create({
            tenantId: resolvedTenantId,
            action: 'alert_escalated',
            resourceType: 'alert',
            resourceId: alert._id,
            details: {
              originalStatus: 'new',
              newStatus: 'escalated',
              escalationTargets: escalationTargets.map(t => t.fullName),
              timeSinceTrigger: `${Math.round((Date.now() - alert.triggeredAt.getTime()) / 1000 / 60)} minutes`
            },
            timestamp: new Date()
          });
        }

        escalated++;
        logger.info('Alert %s escalated successfully', alert._id);
      } catch (error) {
        escalationsFailed++;
        logger.warn('Failed to escalate alert %s: %s', alert._id, error.message);
      }
    }

    logger.info('Alert escalation completed: %d escalated, %d failures', escalated, escalationsFailed);

    return {
      status: 'completed',
      alertsFound: newAlerts.length,
      alertsEscalated: escalated,
      escalationsFailed,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Alert escalation cron failed: %s', error.message);
    throw error;
  }
};
