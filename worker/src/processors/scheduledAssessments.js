const logger = require('../logger');

module.exports = async function scheduledAssessmentsProcessor() {
  try {
    logger.info('Starting scheduled assessments cron job (timezone: Asia/Kolkata)');

    const Employee = require('../models/Employee');
    const { queues } = require('../worker');

    // Get today's date in Asia/Kolkata timezone
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Find active employees with scheduled assessments for today
    const employees = await Employee.find({
      status: 'active',
      'assessmentSchedule.nextScheduledDate': {
        $gte: startOfDay,
        $lt: endOfDay
      },
      'assessmentSchedule.autoReminderEnabled': true,
      'wellnessProfile.consentActive': true
    }).populate('tenantId');

    logger.info('Found %d employees with scheduled assessments for today', employees.length);

    let emailsQueued = 0;
    let updatesFailed = 0;

    for (const employee of employees) {
      try {
        // Queue assessment invite email
        if (employee.email) {
          await queues.emailNotifications.add(
            {
              type: 'assessment_invite',
              to: employee.email,
              templateData: {
                employeeName: employee.fullName,
                employeeId: employee.employeeId,
                assessmentLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/assessment/${employee._id}`,
                reminderTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              }
            },
            { jobId: `assessment-${employee._id}-${Date.now()}` }
          );
          emailsQueued++;
          logger.debug('Assessment reminder queued for employee %s', employee.employeeId);
        }

        // Calculate next scheduled date based on frequency
        const frequency = employee.assessmentSchedule.frequency || 'weekly'; // weekly, fortnightly, monthly, quarterly
        const nextDate = new Date(employee.assessmentSchedule.nextScheduledDate);

        switch (frequency) {
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'fortnightly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          default:
            nextDate.setDate(nextDate.getDate() + 7);
        }

        // Update next scheduled date
        employee.assessmentSchedule.nextScheduledDate = nextDate;
        employee.assessmentSchedule.lastReminderSentAt = new Date();
        await employee.save();

        logger.debug('Next scheduled date updated for employee %s to %s', employee.employeeId, nextDate.toISOString());
      } catch (error) {
        updatesFailed++;
        logger.warn('Failed to process employee %s: %s', employee.employeeId, error.message);
      }
    }

    logger.info(
      'Scheduled assessments cron completed: %d employees processed, %d emails queued, %d failures',
      employees.length,
      emailsQueued,
      updatesFailed
    );

    return {
      status: 'completed',
      employeesProcessed: employees.length,
      emailsQueued,
      updatesFailed,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Scheduled assessments cron failed: %s', error.message);
    throw error;
  }
};
