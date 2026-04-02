/**
 * Follow-Up Reminder Processor
 * ─────────────────────────────
 * Runs 3 days after a high-risk session.
 * Sends a WhatsApp/email ping: "How are you feeling today?"
 * Employee replies Better / Same / Harder → stored in OutcomeFollowUp.
 */

const logger = require('../logger');

module.exports = async function followUpReminderProcessor(job) {
  const { followUpId, employeeId, tenantId } = job.data;

  try {
    logger.info('[followUp] Processing reminder for followUpId=%s employee=%s', followUpId, employeeId);

    const mongoose       = require('mongoose');
    const Employee       = require('../models/Employee');

    // Lazy-load OutcomeFollowUp (API model — shared MongoDB)
    let OutcomeFollowUp;
    try {
      OutcomeFollowUp = require('../../api/src/models/OutcomeFollowUp');
    } catch {
      // If path differs in deployment, try the installed module path
      const path = require('path');
      const modelPath = path.resolve(__dirname, '../../../api/src/models/OutcomeFollowUp');
      OutcomeFollowUp = require(modelPath);
    }

    const followUp = await OutcomeFollowUp.findById(followUpId);
    if (!followUp) {
      logger.warn('[followUp] Record not found: %s — skipping', followUpId);
      return { skipped: true, reason: 'not_found' };
    }

    if (followUp.status !== 'pending') {
      logger.info('[followUp] Already processed (%s) — skipping', followUp.status);
      return { skipped: true, reason: `already_${followUp.status}` };
    }

    if (followUp.expiresAt && new Date() > followUp.expiresAt) {
      await OutcomeFollowUp.findByIdAndUpdate(followUpId, { status: 'expired' });
      logger.info('[followUp] Expired — marking and skipping');
      return { skipped: true, reason: 'expired' };
    }

    // Get employee details
    const employee = await Employee.findOne({ employeeId });
    const phone    = employee?.phone || employee?.mobile;
    const email    = employee?.email;
    const name     = employee?.firstName || employee?.fullName?.split(' ')[0] || 'there';

    let sent = false;
    const channel = phone ? 'whatsapp' : email ? 'email' : null;

    if (channel === 'whatsapp' && phone) {
      try {
        // WhatsApp service — load from API service
        let wa;
        try {
          wa = require('../../api/src/services/whatsappService');
        } catch {
          const path = require('path');
          wa = require(path.resolve(__dirname, '../../../api/src/services/whatsappService'));
        }
        await wa.sendFollowUpPing({ phone, name, sessionId: followUp.sessionId });
        sent = true;
        logger.info('[followUp] WhatsApp sent to %s', phone.replace(/\d(?=\d{4})/g, '*'));
      } catch (waErr) {
        logger.warn('[followUp] WhatsApp failed: %s — trying email', waErr.message);
      }
    }

    if (!sent && email) {
      // Fallback: email follow-up
      const { queues } = require('../worker');
      await queues.emailNotifications.add({
        type: 'followup_ping',
        to:   email,
        templateData: { name, sessionId: followUp.sessionId, followUpId },
      }, { jobId: `followup-email-${followUpId}` });
      sent = true;
      logger.info('[followUp] Email fallback queued for %s', email);
    }

    if (!sent) {
      logger.warn('[followUp] No contact method for employee %s', employeeId);
    }

    // Mark as sent
    await OutcomeFollowUp.findByIdAndUpdate(followUpId, {
      status:  sent ? 'sent' : 'pending',
      sentAt:  sent ? new Date() : null,
      channel: channel || 'email',
    });

    logger.info('[followUp] Reminder processed — sent=%s followUpId=%s', sent, followUpId);
    return { followUpId, sent, channel };

  } catch (err) {
    logger.error('[followUp] Processor failed: %s', err.message, { followUpId });
    throw err;  // Bull will retry
  }
};
