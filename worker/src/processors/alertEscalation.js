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
        // Update alert status
        alert.status = 'escalated';
        alert.escalatedAt = new Date();
        await alert.save();

        // Find escalation targets (Senior Clinician or Company Admin for tenant)
        const escalationTargets = await Employee.find({
          tenantId: alert.tenantId._id,
          role: { $in: ['SENIOR_CLINICIAN', 'COMPANY_ADMIN'] },
          status: 'active'
        });

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

        // Create audit log entry
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
          tenantId: alert.tenantId._id,
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
