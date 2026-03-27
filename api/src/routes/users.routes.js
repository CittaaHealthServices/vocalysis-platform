/**
 * /users/* routes — User self-service and management
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

// ============================================================================
// GET /users/me — current user's full profile
// ============================================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash -salt -mfaSecret')
      .lean();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to load profile' } });
  }
});

// ============================================================================
// PATCH /users/me — update own profile
// ============================================================================
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'gender', 'dateOfBirth', 'profilePhotoUrl', 'notificationPreferences'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(
      req.user._id,
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
// GET /users — list users in tenant (admin/hr only)
// ============================================================================
router.get('/', requireAuth, requireRole(['COMPANY_ADMIN', 'HR_ADMIN', 'CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { role, page = 1, limit = 50, search } = req.query;
    const query = { tenantId, isActive: true };
    if (role) query.role = role;
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
// GET /users/clinicians — list clinicians/psychologists in tenant
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
// POST /users/clinicians — add new psychologist/clinician (admin only)
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

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, error: { message: 'Email already registered' } });

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
// PATCH /users/:id — admin update (deactivate / change role etc.)
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
