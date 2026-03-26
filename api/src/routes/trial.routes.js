/**
 * Trial Management Routes
 * POST /trial/start         — Cittaa admin starts a 14-day trial for a tenant
 * POST /trial/invite        — Invite specific users (HR + employees) to the trial
 * DELETE /trial/invite      — Remove a user from the trial
 * GET  /trial/status        — Get trial status (all roles)
 * POST /trial/convert       — Mark trial as converted to paid plan
 * POST /trial/extend        — Extend trial by N days (admin only)
 */
const express = require('express');
const router  = express.Router();
const Tenant  = require('../models/Tenant');
const User    = require('../models/User');
const logger  = require('../utils/logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');

const TRIAL_DAYS = 14;
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';

/* ── GET /trial/status ─────────────────────────────────────────────────────── */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (tenant.status !== 'trial' || !tenant.trial?.isActive) {
      return res.json({ success: true, data: { isTrial: false } });
    }

    const now      = new Date();
    const expired  = tenant.trial.endDate && tenant.trial.endDate < now;
    const daysLeft = expired
      ? 0
      : Math.ceil((tenant.trial.endDate - now) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      data: {
        isTrial:        true,
        isActive:       !expired,
        expired,
        daysLeft,
        totalDays:      tenant.trial.durationDays || TRIAL_DAYS,
        startDate:      tenant.trial.startDate,
        endDate:        tenant.trial.endDate,
        invitedCount:   tenant.trial.invitedEmails?.length || 0,
        maxUsers:       tenant.trial.maxUsers || 20,
        allowedRoles:   tenant.trial.allowedRoles,
        converted:      tenant.trial.converted,
      }
    });
  } catch (err) {
    logger.error('Get trial status failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to get trial status' });
  }
});

/* ── POST /trial/start ─────────────────────────────────────────────────────── */
// Only Cittaa admins and company admins can start a trial
router.post('/start', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO']), async (req, res) => {
  try {
    const {
      tenantId,
      durationDays = TRIAL_DAYS,
      maxUsers     = 20,
      allowedRoles = ['HR_ADMIN', 'EMPLOYEE'],
      invitedEmails = [],
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (tenant.trial?.isActive && !tenant.trial?.converted) {
      return res.status(409).json({ success: false, message: 'Tenant already has an active trial' });
    }

    const startDate = new Date();
    const endDate   = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    tenant.status = 'trial';
    tenant.trial  = {
      isActive:     true,
      startDate,
      endDate,
      durationDays,
      maxUsers,
      allowedRoles,
      invitedEmails: invitedEmails.map(e => e.toLowerCase()),
      startedBy:    req.user.userId,
      converted:    false,
    };
    await tenant.save();

    // Send trial invitation emails to all invited users
    for (const email of invitedEmails) {
      const user = await User.findOne({ email: email.toLowerCase(), tenantId });
      if (user) {
        await emailService.sendTrialInvite({
          to:          email,
          name:        user.firstName || 'there',
          companyName: tenant.displayName,
          daysLeft:    durationDays,
          endDate,
          loginUrl:    `${PLATFORM_URL}/login`,
        }).catch(err => logger.error('Trial invite email failed', { error: err.message, email }));
      }
    }

    logger.info('Trial started', { tenantId, durationDays, invitedCount: invitedEmails.length, startedBy: req.user.userId });

    res.status(201).json({
      success: true,
      data: {
        message:   `14-day trial started for ${tenant.displayName}`,
        startDate,
        endDate,
        invitedCount: invitedEmails.length,
      }
    });
  } catch (err) {
    logger.error('Start trial failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to start trial' });
  }
});

/* ── POST /trial/invite ────────────────────────────────────────────────────── */
// Add users to an existing trial (company admin OR Cittaa admin)
router.post('/invite', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { emails } = req.body; // array of email strings
    const tenantId   = req.user.role === 'COMPANY_ADMIN' ? req.user.tenantId : req.body.tenantId;

    if (!emails?.length) {
      return res.status(400).json({ success: false, message: 'emails array required' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant || !tenant.trial?.isActive) {
      return res.status(404).json({ success: false, message: 'No active trial found for this tenant' });
    }

    const existing   = new Set((tenant.trial.invitedEmails || []).map(e => e.toLowerCase()));
    const maxUsers   = tenant.trial.maxUsers || 20;
    const newEmails  = emails.map(e => e.toLowerCase()).filter(e => !existing.has(e));

    if (existing.size + newEmails.length > maxUsers) {
      return res.status(400).json({
        success: false,
        message: `Trial is limited to ${maxUsers} users. You can add ${maxUsers - existing.size} more.`,
      });
    }

    tenant.trial.invitedEmails = [...existing, ...newEmails];
    await tenant.save();

    // Send invite emails
    const endDate = tenant.trial.endDate;
    const daysLeft = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)));

    for (const email of newEmails) {
      const user = await User.findOne({ email, tenantId });
      await emailService.sendTrialInvite({
        to:          email,
        name:        user?.firstName || 'there',
        companyName: tenant.displayName,
        daysLeft,
        endDate,
        loginUrl:    `${PLATFORM_URL}/login`,
      }).catch(err => logger.error('Trial invite email failed', { error: err.message, email }));
    }

    res.json({
      success: true,
      data: {
        addedCount:   newEmails.length,
        totalInvited: tenant.trial.invitedEmails.length,
        message:      `${newEmails.length} user(s) added to trial`,
      }
    });
  } catch (err) {
    logger.error('Trial invite failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to invite users' });
  }
});

/* ── DELETE /trial/invite ──────────────────────────────────────────────────── */
router.delete('/invite', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { email }  = req.body;
    const tenantId   = req.user.role === 'COMPANY_ADMIN' ? req.user.tenantId : req.body.tenantId;

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant || !tenant.trial?.isActive) {
      return res.status(404).json({ success: false, message: 'No active trial found' });
    }

    tenant.trial.invitedEmails = (tenant.trial.invitedEmails || [])
      .filter(e => e.toLowerCase() !== email.toLowerCase());
    await tenant.save();

    res.json({ success: true, data: { message: `${email} removed from trial` } });
  } catch (err) {
    logger.error('Trial remove invite failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to remove user' });
  }
});

/* ── POST /trial/convert ───────────────────────────────────────────────────── */
router.post('/convert', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO']), async (req, res) => {
  try {
    const { tenantId, contractTier = 'starter' } = req.body;

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    tenant.status         = 'active';
    tenant.contractTier   = contractTier;
    if (tenant.trial) {
      tenant.trial.converted   = true;
      tenant.trial.convertedAt = new Date();
      tenant.trial.isActive    = false;
    }
    await tenant.save();

    logger.info('Trial converted to paid', { tenantId, contractTier });

    res.json({
      success: true,
      data: { message: `Trial converted to ${contractTier} plan`, tenantId }
    });
  } catch (err) {
    logger.error('Trial convert failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to convert trial' });
  }
});

/* ── POST /trial/extend ────────────────────────────────────────────────────── */
router.post('/extend', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'CITTAA_CEO']), async (req, res) => {
  try {
    const { tenantId, extraDays = 7 } = req.body;

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant || !tenant.trial) {
      return res.status(404).json({ success: false, message: 'No trial found' });
    }

    const currentEnd = tenant.trial.endDate || new Date();
    tenant.trial.endDate = new Date(currentEnd.getTime() + extraDays * 24 * 60 * 60 * 1000);
    tenant.trial.isActive = true;
    if (tenant.status === 'expired') tenant.status = 'trial';
    await tenant.save();

    const newDaysLeft = Math.ceil((tenant.trial.endDate - new Date()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        message:   `Trial extended by ${extraDays} days`,
        newEndDate: tenant.trial.endDate,
        daysLeft:   newDaysLeft,
      }
    });
  } catch (err) {
    logger.error('Trial extend failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to extend trial' });
  }
});

module.exports = router;
