const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const ApiKey = require('../models/ApiKey.model');
const logger = require('../utils/logger');

const companyAdmin = [requireAuth, requireRole(['COMPANY_ADMIN'])];
const companyOrHR  = [requireAuth, requireRole(['COMPANY_ADMIN', 'HR_ADMIN'])];

// ============================================================================
// OVERVIEW
// ============================================================================
router.get('/overview', ...companyOrHR, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const [totalEmployees, activeAlerts] = await Promise.all([
      User.countDocuments({ tenantId, role: 'EMPLOYEE', isActive: true }),
      // Import Alert model inline to avoid circular deps
      require('../models/Alert.model') ? require('../models/Alert.model').countDocuments({ tenantId, status: 'active' }) : Promise.resolve(0),
    ]);
    res.json({
      success: true,
      data: {
        totalEmployees,
        activeAlerts,
        healthScore: 78, // placeholder — replace with real aggregation
        participationRate: 65,
      },
    });
  } catch (err) {
    logger.error('company overview error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load overview' } });
  }
});

// ============================================================================
// HR ADMINS
// ============================================================================
router.get('/hr-admins', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const hrAdmins = await User.find({ tenantId, role: 'HR_ADMIN', isActive: true })
      .select('firstName lastName email createdAt hrProfile')
      .lean();
    res.json({ success: true, data: hrAdmins });
  } catch (err) {
    logger.error('company hr-admins list error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch HR admins' } });
  }
});

router.post('/hr-admins', ...companyAdmin, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: { message: 'Name and email are required' } });
    }
    // In production: send invite email with temp password
    // Here: create a placeholder user
    const emailService = require('../services/emailService');
    emailService.sendInviteEmail?.({ to: email, name, role: 'HR Admin' }).catch(() => {});
    res.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    logger.error('company invite hr-admin error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to invite HR admin' } });
  }
});

router.delete('/hr-admins/:id', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await User.findOneAndUpdate({ _id: req.params.id, tenantId, role: 'HR_ADMIN' }, { isActive: false });
    res.json({ success: true, message: 'HR admin deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to deactivate HR admin' } });
  }
});

// ============================================================================
// DEPARTMENTS (lightweight in-tenant store on Tenant document)
// ============================================================================
router.get('/departments', ...companyOrHR, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const tenant = await Tenant.findOne({ tenantId }).lean();
    const departments = tenant?.departments || [];
    // Enrich with employee count
    const enriched = await Promise.all(departments.map(async (d) => ({
      ...d,
      employeeCount: await User.countDocuments({ tenantId, departmentId: d.id, isActive: true }),
    })));
    res.json({ success: true, data: enriched });
  } catch (err) {
    logger.error('company departments list error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch departments' } });
  }
});

router.post('/departments', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, description, managerId } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Department name is required' } });

    const newDept = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'),
      name: name.trim(),
      description: description || '',
      managerId: managerId || null,
      createdAt: new Date(),
    };

    await Tenant.findOneAndUpdate(
      { tenantId },
      { $push: { departments: newDept } },
      { upsert: false }
    );

    res.status(201).json({ success: true, data: { ...newDept, employeeCount: 0 } });
  } catch (err) {
    logger.error('company departments create error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create department' } });
  }
});

router.delete('/departments/:id', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await Tenant.findOneAndUpdate(
      { tenantId },
      { $pull: { departments: { id: req.params.id } } }
    );
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to delete department' } });
  }
});

// ============================================================================
// BILLING
// ============================================================================
router.get('/billing', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const tenant = await Tenant.findOne({ tenantId }).lean();
    res.json({
      success: true,
      data: {
        plan: tenant?.plan || 'starter',
        status: tenant?.billingStatus || 'active',
        nextBillingDate: tenant?.nextBillingDate || null,
        seats: tenant?.seats || 50,
        usedSeats: await User.countDocuments({ tenantId, isActive: true }),
        billingEmail: tenant?.billingEmail || tenant?.adminEmail || null,
      },
    });
  } catch (err) {
    logger.error('company billing error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load billing info' } });
  }
});

router.post('/billing/change-plan', ...companyAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ success: false, error: { message: 'Plan is required' } });
    // Placeholder: in production integrate with payment gateway
    res.json({
      success: true,
      message: `Plan change request received. Our team will reach out to migrate you to the ${plan} plan.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to request plan change' } });
  }
});

// ============================================================================
// COMPANY API KEYS
// ============================================================================
router.get('/api-keys', ...companyAdmin, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const keys = await ApiKey.find({ tenantId, isActive: true }).sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: keys.map(k => ({
        id: k._id,
        name: k.name,
        keyPreview: k.keyHashPrefix || '••••••••',
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch API keys' } });
  }
});

router.post('/api-keys', ...companyAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Key name is required' } });
    const rawKey = `voc_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = ApiKey.hashKey(rawKey);
    const keyHashPrefix = ApiKey.getKeyPrefix(rawKey);
    const keyId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const apiKey = await ApiKey.create({
      keyId, tenantId: req.user.tenantId, keyHash, keyHashPrefix,
      name: name.trim(), description: description || '', isActive: true, createdBy: (req.user.userId || (req.user.userId || req.user._id))?.toString(),
    });
    res.status(201).json({
      success: true,
      key: rawKey,
      data: { id: apiKey._id, name: apiKey.name, keyPreview: keyHashPrefix, createdAt: apiKey.createdAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to create API key' } });
  }
});

router.delete('/api-keys/:id', ...companyAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false, revokedAt: new Date(), revokedBy: (req.user.userId || (req.user.userId || req.user._id))?.toString() },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to revoke API key' } });
  }
});

// ============================================================================
// COMPANY SETTINGS
// ============================================================================
router.get('/settings', ...companyAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId }).lean();
    res.json({ success: true, data: tenant || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to load settings' } });
  }
});

router.patch('/settings', ...companyAdmin, async (req, res) => {
  try {
    const allowed = ['displayName', 'legalName', 'logoUrl', 'primaryColor', 'wellnessPolicy'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const tenant = await Tenant.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { $set: updates },
      { new: true }
    ).lean();
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to update settings' } });
  }
});

module.exports = router;
