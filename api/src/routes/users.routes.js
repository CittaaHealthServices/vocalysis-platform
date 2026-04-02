/**
 * Users routes — manage non-employee platform users (HR admins, psychologists, etc.)
 * Mounted at /users
 */
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const User    = require('../models/User');
const Tenant  = require('../models/Tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger  = require('../utils/logger');
const emailService = require('../services/emailService');

const ADMIN_ROLES = [
  'CITTAA_SUPER_ADMIN', 'CITTAA_CEO',
  'HR_ADMIN', 'COMPANY_ADMIN',
];

// ── List users ────────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, status } = req.query;
    const tenantId = req.user.tenantId;

    const isCittaaAdmin = ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO'].includes(req.user.role);

    // Cittaa admins can search all tenants; others are scoped to their tenant
    let query = isCittaaAdmin ? {} : { tenantId };

    if (role) {
      query.role = { $in: role.split(',') };
    } else {
      query.role = { $nin: ['EMPLOYEE'] };
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.isActive = status === 'active';

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash -salt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / +limit) },
      },
    });
  } catch (err) {
    logger.error('Failed to list users', { error: err.message });
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ── Create user ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const {
      email, firstName, lastName, phone,
      role = 'HR_ADMIN', department, joiningDate,
      specialization,
    } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, firstName, and lastName are required' });
    }

    const ALLOWED_ROLES = [
      'HR_ADMIN', 'COMPANY_ADMIN',
      'CLINICAL_PSYCHOLOGIST', 'SENIOR_CLINICIAN',
      'CITTAA_SUPER_ADMIN', 'CITTAA_CEO',
    ];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` });
    }

    const tenantId = req.user.tenantId;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');

    const user = new User({
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      phone:     phone?.trim() || undefined,
      role,
      tenantId,
      department,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      isActive: true,
      createdBy: req.user.userId,
      ...(specialization && { clinicianProfile: { specialisation: specialization } }),
    });

    await user.setPassword(tempPassword);
    await user.save();

    // Send welcome email (non-blocking)
    const tenant = await Tenant.findOne({ tenantId }).lean().catch(() => null);
    emailService.sendWelcomeEmail({
      to: normalizedEmail,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app'}/login`,
      tempPassword,
      companyName: tenant?.displayName || tenant?.legalName || 'Vocalysis',
    }).catch(err => logger.error('Welcome email failed', { error: err.message }));

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
      },
    });
  } catch (err) {
    logger.error('Failed to create user', { error: err.message });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── Get single user ───────────────────────────────────────────────────────────
router.get('/:id', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -salt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── Update user ───────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allowed = ['firstName', 'lastName', 'phone', 'department', 'isActive', 'role'];
    for (const f of allowed) {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    }
    await user.save();
    res.json({ success: true, message: 'User updated', data: { id: user._id, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
