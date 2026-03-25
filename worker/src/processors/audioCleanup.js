const logger = require('../logger');

module.exports = async function audioCleanupProcessor() {
  try {
    logger.info('Starting audio cleanup cron job (runs every 5 minutes)');

    const Session = require('../models/Session');
    const AuditLog = require('../models/AuditLog');

    // Find sessions where audio wasn't confirmed deleted within 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Step 1: Find sessions that should have been cleaned
    const sessionsToClean = await Session.find({
      audioDeleteConfirmed: false,
      createdAt: { $lt: thirtyMinutesAgo },
      analysisStatus: 'completed'
    });

    logger.info('Found %d sessions needing audio cleanup', sessionsToClean.length);

    let cleaned = 0;
    let auditLogsCreated = 0;

    for (const session of sessionsToClean) {
      try {
        // Mark as deleted
        session.audioDeleteConfirmed = true;
        session.audioDeletedAt = new Date();
        await session.save();

        cleaned++;
        logger.debug('Audio cleanup confirmed for session %s', session._id);

        // If created more than 60 minutes ago and still not confirmed, create audit log
        if (session.createdAt < sixtyMinutesAgo) {
          logger.warn('Session %s audio not deleted within 60 minutes - creating audit entry', session._id);

          await AuditLog.create({
            tenantId: session.tenantId,
            action: 'audio_cleanup_delayed',
            resourceType: 'session',
            resourceId: session._id,
            severity: 'medium',
            details: {
              delayMinutes: Math.round((Date.now() - session.createdAt.getTime()) / 1000 / 60),
              reason: 'Audio not confirmed deleted within expected timeframe',
              requiresManualReview: true
            },
            timestamp: new Date()
          });

          auditLogsCreated++;
        }
      } catch (error) {
        logger.warn('Failed to cleanup session %s: %s', session._id, error.message);
      }
    }

    // Step 2: Check for any orphaned sessions (older than 24 hours without confirmed delete)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphanedSessions = await Session.find({
      audioDeleteConfirmed: false,
      createdAt: { $lt: oneDayAgo }
    });

    logger.warn('Found %d orphaned sessions (older than 24 hours without delete confirmation)', orphanedSessions.length);

    for (const session of orphanedSessions) {
      try {
        await AuditLog.create({
          tenantId: session.tenantId,
          action: 'orphaned_session_detected',
          resourceType: 'session',
          resourceId: session._id,
          severity: 'high',
          details: {
            ageHours: Math.round((Date.now() - session.createdAt.getTime()) / 1000 / 60 / 60),
            requiresManualReview: true,
            possibleCauses: [
              'Worker process crashed before audio cleanup',
              'Database write failure after analysis',
              'Concurrent processing error'
            ]
          },
          timestamp: new Date()
        });

        logger.warn('Audit log created for orphaned session %s', session._id);
      } catch (error) {
        logger.error('Failed to create audit log for orphaned session %s: %s', session._id, error.message);
      }
    }

    logger.info(
      'Audio cleanup completed: %d sessions cleaned, %d audit logs created, %d orphaned sessions detected',
      cleaned,
      auditLogsCreated,
      orphanedSessions.length
    );

    return {
      status: 'completed',
      sessionsCleaned: cleaned,
      auditLogsCreated,
      orphanedSessionsDetected: orphanedSessions.length,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Audio cleanup cron failed: %s', error.message);
    throw error;
  }
};
