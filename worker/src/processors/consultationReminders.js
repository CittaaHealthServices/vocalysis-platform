const logger = require('../logger');

module.exports = async function consultationRemindersProcessor() {
  try {
    logger.info('Starting consultation reminders cron job (runs every 15 minutes)');

    const Consultation = require('../models/Consultation');
    const Employee = require('../models/Employee');
    const { queues } = require('../worker');

    const now = new Date();

    // Find consultations with reminders due
    // 60-minute reminder: scheduled between (now + 55min) and (now + 65min)
    const sixtyMinReminder = new Date(now.getTime() + 60 * 60 * 1000);
    const sixtyMinWindowStart = new Date(sixtyMinReminder.getTime() - 5 * 60 * 1000);
    const sixtyMinWindowEnd = new Date(sixtyMinReminder.getTime() + 5 * 60 * 1000);

    // 15-minute reminder: scheduled between (now + 10min) and (now + 20min)
    const fifteenMinReminder = new Date(now.getTime() + 15 * 60 * 1000);
    const fifteenMinWindowStart = new Date(fifteenMinReminder.getTime() - 5 * 60 * 1000);
    const fifteenMinWindowEnd = new Date(fifteenMinReminder.getTime() + 5 * 60 * 1000);

    // Query for consultations needing 60-minute reminders
    const sixtyMinConsultations = await Consultation.find({
      status: { $in: ['scheduled', 'confirmed'] },
      scheduledAt: { $gte: sixtyMinWindowStart, $lte: sixtyMinWindowEnd }
    }).populate('employeeId').populate('clinicianId');

    logger.info('Found %d consultations needing 60-minute reminders', sixtyMinConsultations.length);

    // Query for consultations needing 15-minute reminders
    const fifteenMinConsultations = await Consultation.find({
      status: { $in: ['scheduled', 'confirmed'] },
      scheduledAt: { $gte: fifteenMinWindowStart, $lte: fifteenMinWindowEnd }
    }).populate('employeeId').populate('clinicianId');

    logger.info('Found %d consultations needing 15-minute reminders', fifteenMinConsultations.length);

    let remindersQueued = 0;
    let remindersFailed = 0;

    // Process 60-minute reminders
    for (const consultation of sixtyMinConsultations) {
      try {
        // Check if 60-minute reminder already sent
        if (!consultation.remindersSent) {
          consultation.remindersSent = [];
        }

        const sixtyMinReminded = consultation.remindersSent.some(r => r.type === '60min');

        if (!sixtyMinReminded) {
          // Send reminder to clinician
          if (consultation.clinicianId && consultation.clinicianId.email) {
            await queues.emailNotifications.add(
              {
                type: 'consultation_reminder',
                to: consultation.clinicianId.email,
                templateData: {
                  recipientName: consultation.clinicianId.fullName,
                  recipientType: 'clinician',
                  scheduledTime: consultation.scheduledAt.toLocaleString('en-IN'),
                  duration: consultation.duration || '30 minutes',
                  otherPartyName: consultation.employeeId ? consultation.employeeId.fullName : 'Employee',
                  joinLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/consultation/${consultation._id}`,
                  reminderType: '60 minutes before'
                }
              },
              { jobId: `reminder-60min-${consultation._id}-clinician-${Date.now()}` }
            );
            remindersQueued++;
            logger.debug('60-minute reminder queued for clinician: %s', consultation.clinicianId.fullName);
          }

          // Send reminder to employee
          if (consultation.employeeId && consultation.employeeId.email) {
            await queues.emailNotifications.add(
              {
                type: 'consultation_reminder',
                to: consultation.employeeId.email,
                templateData: {
                  recipientName: consultation.employeeId.fullName,
                  recipientType: 'employee',
                  scheduledTime: consultation.scheduledAt.toLocaleString('en-IN'),
                  duration: consultation.duration || '30 minutes',
                  otherPartyName: consultation.clinicianId ? consultation.clinicianId.fullName : 'Healthcare Provider',
                  joinLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/consultation/${consultation._id}`,
                  reminderType: '60 minutes before'
                }
              },
              { jobId: `reminder-60min-${consultation._id}-employee-${Date.now()}` }
            );
            remindersQueued++;
            logger.debug('60-minute reminder queued for employee: %s', consultation.employeeId.fullName);
          }

          // Update reminder tracking
          consultation.remindersSent.push({
            type: '60min',
            sentAt: new Date()
          });
          await consultation.save();
        }
      } catch (error) {
        remindersFailed++;
        logger.warn('Failed to send 60-minute reminder for consultation %s: %s', consultation._id, error.message);
      }
    }

    // Process 15-minute reminders
    for (const consultation of fifteenMinConsultations) {
      try {
        // Check if 15-minute reminder already sent
        if (!consultation.remindersSent) {
          consultation.remindersSent = [];
        }

        const fifteenMinReminded = consultation.remindersSent.some(r => r.type === '15min');

        if (!fifteenMinReminded) {
          // Send reminder to clinician
          if (consultation.clinicianId && consultation.clinicianId.email) {
            await queues.emailNotifications.add(
              {
                type: 'consultation_reminder',
                to: consultation.clinicianId.email,
                templateData: {
                  recipientName: consultation.clinicianId.fullName,
                  recipientType: 'clinician',
                  scheduledTime: consultation.scheduledAt.toLocaleString('en-IN'),
                  duration: consultation.duration || '30 minutes',
                  otherPartyName: consultation.employeeId ? consultation.employeeId.fullName : 'Employee',
                  joinLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/consultation/${consultation._id}`,
                  reminderType: '15 minutes before'
                }
              },
              { jobId: `reminder-15min-${consultation._id}-clinician-${Date.now()}` }
            );
            remindersQueued++;
            logger.debug('15-minute reminder queued for clinician: %s', consultation.clinicianId.fullName);
          }

          // Send reminder to employee
          if (consultation.employeeId && consultation.employeeId.email) {
            await queues.emailNotifications.add(
              {
                type: 'consultation_reminder',
                to: consultation.employeeId.email,
                templateData: {
                  recipientName: consultation.employeeId.fullName,
                  recipientType: 'employee',
                  scheduledTime: consultation.scheduledAt.toLocaleString('en-IN'),
                  duration: consultation.duration || '30 minutes',
                  otherPartyName: consultation.clinicianId ? consultation.clinicianId.fullName : 'Healthcare Provider',
                  joinLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/consultation/${consultation._id}`,
                  reminderType: '15 minutes before'
                }
              },
              { jobId: `reminder-15min-${consultation._id}-employee-${Date.now()}` }
            );
            remindersQueued++;
            logger.debug('15-minute reminder queued for employee: %s', consultation.employeeId.fullName);
          }

          // Update reminder tracking
          consultation.remindersSent.push({
            type: '15min',
            sentAt: new Date()
          });
          await consultation.save();
        }
      } catch (error) {
        remindersFailed++;
        logger.warn('Failed to send 15-minute reminder for consultation %s: %s', consultation._id, error.message);
      }
    }

    logger.info('Consultation reminders completed: %d queued, %d failures', remindersQueued, remindersFailed);

    return {
      status: 'completed',
      sixtyMinConsultations: sixtyMinConsultations.length,
      fifteenMinConsultations: fifteenMinConsultations.length,
      remindersQueued,
      remindersFailed,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Consultation reminders cron failed: %s', error.message);
    throw error;
  }
};
