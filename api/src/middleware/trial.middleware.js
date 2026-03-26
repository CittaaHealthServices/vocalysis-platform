/**
 * Trial Access Middleware
 * Validates that the requesting user has access during an active trial period.
 *
 * Rules:
 *  - If tenant status is 'trial': only users whose email is in trial.invitedEmails,
 *    AND whose role is in trial.allowedRoles, may proceed.
 *  - If the trial has expired (endDate < now): block and return 402 with
 *    { code: 'TRIAL_EXPIRED' }.
 *  - CITTAA_SUPER_ADMIN and CITTAA_CEO are always allowed through (platform staff).
 *  - COMPANY_ADMIN is always allowed through (they manage the trial).
 */
const Tenant = require('../models/Tenant');
const logger  = require('../utils/logger');

const ALWAYS_ALLOWED = ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'COMPANY_ADMIN'];

/**
 * requireTrialAccess — attach after requireAuth.
 *
 * Usage in routes:
 *   router.get('/data', requireAuth, requireTrialAccess, handler)
 */
async function requireTrialAccess(req, res, next) {
  try {
    const { role, email, tenantId } = req.user;

    // Platform staff & company admins always pass
    if (ALWAYS_ALLOWED.includes(role)) return next();

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // If not on trial, no trial checks needed
    if (tenant.status !== 'trial' || !tenant.trial?.isActive) return next();

    const now = new Date();

    // Trial expired?
    if (tenant.trial.endDate && tenant.trial.endDate < now) {
      return res.status(402).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        message: 'Your 14-day trial has ended. Please upgrade to continue.',
        trialEndedAt: tenant.trial.endDate,
      });
    }

    // Role allowed during trial?
    const allowedRoles = tenant.trial.allowedRoles || ['HR_ADMIN', 'EMPLOYEE'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        code: 'TRIAL_ROLE_RESTRICTED',
        message: 'Your role does not have access during the trial period.',
      });
    }

    // Email must be in the invited list
    const invitedEmails = (tenant.trial.invitedEmails || []).map(e => e.toLowerCase());
    if (!invitedEmails.includes(email.toLowerCase())) {
      return res.status(403).json({
        success: false,
        code: 'TRIAL_NOT_INVITED',
        message: 'You have not been invited to the trial. Please contact your administrator.',
      });
    }

    // All good — attach trial info to req for downstream use
    const daysLeft = Math.max(
      0,
      Math.ceil((tenant.trial.endDate - now) / (1000 * 60 * 60 * 24))
    );
    req.trial = {
      isActive:  true,
      daysLeft,
      endDate:   tenant.trial.endDate,
      startDate: tenant.trial.startDate,
    };

    next();
  } catch (err) {
    logger.error('Trial access check failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Access check failed' });
  }
}

/**
 * getTrialStatus — returns trial info for the current user's tenant.
 * Attaches req.trial even for non-trial tenants (trial.isActive = false).
 */
async function getTrialStatus(req, res, next) {
  try {
    const { tenantId } = req.user;
    const tenant = await Tenant.findOne({ tenantId });

    if (!tenant || tenant.status !== 'trial' || !tenant.trial?.isActive) {
      req.trial = { isActive: false };
      return next();
    }

    const now = new Date();
    const expired = tenant.trial.endDate && tenant.trial.endDate < now;
    const daysLeft = expired
      ? 0
      : Math.ceil((tenant.trial.endDate - now) / (1000 * 60 * 60 * 24));

    req.trial = {
      isActive:  !expired,
      expired,
      daysLeft,
      endDate:   tenant.trial.endDate,
      startDate: tenant.trial.startDate,
    };

    next();
  } catch {
    req.trial = { isActive: false };
    next();
  }
}

module.exports = { requireTrialAccess, getTrialStatus };
