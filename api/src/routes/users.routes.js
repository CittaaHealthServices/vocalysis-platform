/**
 * /users/* routes ÃÂ¢ÃÂÃÂ User self-service and management
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

// ============================================================================
// GET /users/me ÃÂ¢ÃÂÃÂ current user's full profile
// ============================================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId || req.user._id })
      .select('-passwordHash -salt -mfaSecret')
      .lean();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to load profile' } });
  }
});

// ============================================================================
// PATCH /users/me ÃÂ¢ÃÂÃÂ update own profile
// ============================================================================
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'gender', 'dateOfBirth', 'profilePhotoUrl', 'notificationPreferences'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updates },
      { new: true }
    ).select('-passwordHash -salt -mfaSecret').lean();

    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('users/me patch error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to update profile' } });
  }
});

// ============================================================================
// GET /users ÃÂ¢ÃÂÃÂ list users in tenant (admin/hr only)
//   Super admins may pass ?tenantId=xxx to list users for any tenant
// ============================================================================
router.get('/', requireAuth, requireRole(['COMPANY_ADMIN', 'HR_ADMIN', 'CITTAA_SUPER_ADMIN', 'CITTAA_CEO', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST']), async (req, res) => {
  try {
    const isSuperAdmin = ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO'].includes(req.user.role);
    // Super admins can specify a target tenantId; others are scoped to their own
    const targetTenantId = (isSuperAdmin && req.query.tenantId) ? req.query.tenantId : req.user.tenantId;
    const { role, page = 1, limit = 50, search } = req.query;
    const query = { tenantId: targetTenantId };
    // Support comma-separated roles e.g. role=SENIOR_CLINICIAN,CLINICAL_PSYCHOLOGIST
    if (role) {
      const roles = role.split(',').map(r => r.trim()).filter(Boolean);
      query.role = roles.length === 1 ? roles[0] : { $in: roles };
    }
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ firstName: re }, { lastName: re }, { email: re }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(Number(limit)).select('-passwordHash -salt -mfaSecret').lean(),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: users, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to list users' } });
  }
});

// ============================================================================
// POST /users ÃÂ¢ÃÂÃÂ create a user in any tenant (super admin only)
// ============================================================================
router.post('/', requireAuth, requireRole(['CITTAA_SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const {
      email, firstName, lastName, role, tenantId: bodyTenantId,
      password, phone,
    } = req.body;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ success: false, error: { message: 'email, firstName, lastName, and role are required' } });
    }

    // Super admins can create in any tenant; company admins only in their own
    const isSuperAdmin = req.user.role === 'CITTAA_SUPER_ADMIN';
    const targetTenantId = (isSuperAdmin && bodyTenantId) ? bodyTenantId : req.user.tenantId;
    if (!targetTenantId) {
      return res.status(400).json({ success: false, error: { message: 'tenantId is required' } });
    }

    // Scope duplicate check to the target tenant ÃÂ¢ÃÂÃÂ the same email is allowed
    // across different tenants (e.g. a consultant working at multiple companies)
    const existing = await User.findOne({ email: email.toLowerCase(), tenantId: targetTenantId });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'A user with this email already exists in this organisation' } });
    }

    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const tempPassword = password || crypto.randomBytes(8).toString('hex');

    const newUser = new User({
      email: email.toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      tenantId: targetTenantId,
      isActive: true,
      isEmailVerified: false,
      loginAttempts: 0,
      phone: phone || '',
      consentRecord: { consentGiven: false, dataProcessingConsent: false },
      notificationPreferences: { emailAlerts: true, inAppAlerts: true },
      createdBy: (req.user.userId || req.user._id),
    });
    await newUser.setPassword(tempPassword);
    await newUser.save();

    // Post-save operations (non-fatal)
    try {
    // Send welcome email with temp password
    const emailService = require('../services/emailService');
    emailService.sendWelcomeEmail?.({
      to: email,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app'}/login`,
      tempPassword,
      companyName: targetTenantId,
    }).catch(() => {});
    } catch (postSaveErr) {
      logger.warn('Post-save operations failed', { error: postSaveErr.message });
    }

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        tenantId: newUser.tenantId,
        isActive: newUser.isActive,
      },
    });
  } catch (err) {
    logger.error('POST /users error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create user' } });
  }
});

// ============================================================================
// GET /users/clinicians ÃÂ¢ÃÂÃÂ list clinicians/psychologists in tenant
// ============================================================================
router.get('/clinicians', requireAuth, async (req, res) => {
  try {
    const query = {
      tenantId: req.user.tenantId,
      isActive: true,
      role: { $in: ['SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'] },
    };
    const clinicians = await User.find(query)
      .select('firstName lastName email role clinicianProfile createdAt')
      .lean();
    res.json({ success: true, data: clinicians });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to list clinicians' } });
  }
});

// ============================================================================
// POST /users/clinicians ÃÂ¢ÃÂÃÂ add new psychologist/clinician (admin only)
// ============================================================================
router.post('/clinicians', requireAuth, requireRole(['COMPANY_ADMIN', 'CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const {
      firstName, lastName, email, role = 'CLINICAL_PSYCHOLOGIST',
      rciRegistrationNumber, specialisation, yearsOfExperience, languagesSpoken, qualifications,
      password,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, error: { message: 'firstName, lastName, email, and password are required' } });
    }

    const allowedRoles = ['CLINICAL_PSYCHOLOGIST', 'SENIOR_CLINICIAN'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: { message: 'Role must be CLINICAL_PSYCHOLOGIST or SENIOR_CLINICIAN' } });
    }

    // Scope to tenant ÃÂ¢ÃÂÃÂ same email allowed across different tenants
    const existing = await User.findOne({ email: email.toLowerCase(), tenantId: req.user.tenantId });
    if (existing) return res.status(409).json({ success: false, error: { message: 'A user with this email already exists in this organisation' } });

    const tenantId = req.body.tenantId || req.user.tenantId;

    const newUser = new User({
      email: email.toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      tenantId,
      isActive: true,
      isEmailVerified: false,
      loginAttempts: 0,
      clinicianProfile: {
        rciRegistrationNumber: rciRegistrationNumber || '',
        specialisation: specialisation || '',
        yearsOfExperience: yearsOfExperience || 0,
        languagesSpoken: languagesSpoken || [],
        qualifications: qualifications || [],
      },
      consentRecord: { consentGiven: false, dataProcessingConsent: false },
      notificationPreferences: { emailAlerts: true, inAppAlerts: true },
    });
    await newUser.setPassword(password);
    await newUser.save();

    // Send welcome email
    const emailService = require('../services/emailService');
    emailService.sendWelcomeEmail?.({
      to: email,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app'}/login`,
      tempPassword: password,
      companyName: 'Vocalysis',
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        clinicianProfile: newUser.clinicianProfile,
      },
    });
  } catch (err) {
    logger.error('create clinician error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create clinician' } });
  }
});

// ============================================================================
// PATCH /users/:id ÃÂ¢ÃÂÃÂ admin update (deactivate / change role etc.)
// ============================================================================
router.patch('/:id', requireAuth, requireRole(['COMPANY_ADMIN', 'HR_ADMIN', 'CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const allowed = ['isActive', 'role', 'firstName', 'lastName', 'phone', 'clinicianProfile'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-passwordHash -salt -mfaSecret').lean();

    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('users/:id patch error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to update user' } });
  }
});

module.exports = router;
