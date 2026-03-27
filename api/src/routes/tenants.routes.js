const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * GET /tenants
 * List all tenants (CITTAA_SUPER_ADMIN only)
 */
router.get('/', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.user._id;
    const requestId = req.requestId;

    let query = {};
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      Tenant.find(query)
        .select('displayName legalName tenantId status contractTier employeeCount createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Tenant.countDocuments(query)
    ]);

    await auditService.log({
      userId,
      tenantId: null,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANTS_LISTED',
      targetResource: 'Tenant',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Failed to list tenants', { error: err.message });
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

/**
 * POST /tenants
 * Create/onboard new tenant
 */
router.post('/', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const {
      name,          // company display name
      industry,
      employeeCount,
      country,
      city,
      adminEmail,
      adminFirstName,
      adminLastName,
      tier,          // 'starter' | 'professional' | 'enterprise'
      monthlyAssessmentQuota,
      website,
      googleConfig
    } = req.body;
    const userId = req.user._id;
    const requestId = req.requestId;

    // Validate required fields
    if (!name || !adminEmail || !adminFirstName || !adminLastName) {
      return res.status(400).json({ error: 'Missing required fields: name, adminEmail, adminFirstName, adminLastName' });
    }

    // Normalise tier — wizard sends 'pro', model enum uses 'professional'
    const contractTier = tier === 'pro' ? 'professional' : (tier || 'starter');

    // Auto-generate a URL-safe tenantId from the company name
    const baseTenantId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const randomSuffix = Math.random().toString(36).slice(2, 6);
    const tenantId = `${baseTenantId}-${randomSuffix}`;

    // Check if tenant already exists (by displayName)
    const existingTenant = await Tenant.findOne({ displayName: name });
    if (existingTenant) {
      return res.status(409).json({ error: 'Tenant with this name already exists' });
    }

    // Check if admin email already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(409).json({ error: 'Admin email already exists' });
    }

    // Create tenant — map wizard fields → model schema
    const tenant = new Tenant({
      tenantId,
      displayName:  name,
      legalName:    name,
      type:         'corporate',
      industry,
      employeeCount: Number(employeeCount) || 0,
      city,
      contactEmail: adminEmail,
      contractTier,
      status:       'active',
      monthlyAssessmentQuota: monthlyAssessmentQuota || 500,
      usedAssessmentCount: 0,
      googleConfig: googleConfig || { autoCreateMeetLinks: false },
      createdBy: userId,
      createdAt: new Date()
    });

    await tenant.save();

    // Create admin user
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const admin = new User({
      email: adminEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      password: hashedPassword,
      role: 'COMPANY_ADMIN',
      tenantId: tenant.tenantId,   // string tenantId, not ObjectId
      isActive: true,
      createdBy: userId,
      createdAt: new Date()
    });

    await admin.save();

    // Send welcome email to admin
    await emailService.sendWelcomeEmail({
      to: adminEmail,
      name: adminFirstName,
      loginUrl: `${process.env.PLATFORM_URL}/login`,
      tempPassword,
      companyName: name
    }).catch(err => logger.error('Admin welcome email failed', { error: err.message }));

    await auditService.log({
      userId,
      tenantId: tenant._id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_CREATED',
      targetResource: 'Tenant',
      targetId: tenant._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: {
        name,
        industry,
        contractTier,
        adminEmail
      }
    });

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant: {
        id: tenant._id,
        name: tenant.displayName,
        status: tenant.status
      },
      admin: {
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName
      }
    });
  } catch (err) {
    logger.error('Failed to create tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * GET /tenants/:id
 * Get tenant details
 */
router.get('/:id', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findById(id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Users store string tenantId (e.g. "cittaa-3z0z"), not MongoDB ObjectId
    const stringTenantId = tenant.tenantId;

    const [adminCount, employeeCount, totalUsers] = await Promise.all([
      User.countDocuments({ tenantId: stringTenantId, role: { $in: ['COMPANY_ADMIN', 'HR_ADMIN'] } }),
      User.countDocuments({ tenantId: stringTenantId, role: 'EMPLOYEE' }),
      User.countDocuments({ tenantId: stringTenantId }),
    ]);

    await auditService.log({
      userId,
      tenantId: null,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_VIEWED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      tenant,
      stats: {
        adminCount,
        employeeCount,
        totalUsers,
      }
    });
  } catch (err) {
    logger.error('Failed to fetch tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

/**
 * PUT /tenants/:id
 * Update tenant configuration
 */
router.put('/:id', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, monthlyAssessmentQuota, googleConfig, status } = req.body;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findById(id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const originalData = {
      name: tenant.name,
      monthlyAssessmentQuota: tenant.monthlyAssessmentQuota,
      status: tenant.status
    };

    if (name && name !== tenant.name) {
      const existing = await Tenant.findOne({ name });
      if (existing) {
        return res.status(409).json({ error: 'Tenant name already exists' });
      }
      tenant.name = name;
    }

    if (monthlyAssessmentQuota !== undefined) {
      tenant.monthlyAssessmentQuota = monthlyAssessmentQuota;
    }

    if (googleConfig !== undefined) {
      tenant.googleConfig = googleConfig;
    }

    if (status !== undefined) {
      tenant.status = status;
    }

    await tenant.save();

    await auditService.log({
      userId,
      tenantId: id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_UPDATED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: {
        before: originalData,
        after: { name: tenant.name, monthlyAssessmentQuota: tenant.monthlyAssessmentQuota, status: tenant.status }
      }
    });

    res.json({ message: 'Tenant updated', tenant });
  } catch (err) {
    logger.error('Failed to update tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

/**
 * POST /tenants/:id/suspend
 * Suspend tenant
 */
router.post('/:id/suspend', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      {
        status: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: reason
      },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await auditService.log({
      userId,
      tenantId: id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_SUSPENDED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { reason }
    });

    res.json({ message: 'Tenant suspended', tenant });
  } catch (err) {
    logger.error('Failed to suspend tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to suspend tenant' });
  }
});

/**
 * POST /tenants/:id/activate
 * Reactivate suspended tenant
 */
router.post('/:id/activate', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      {
        status: 'active',
        suspendedAt: null,
        suspensionReason: null
      },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await auditService.log({
      userId,
      tenantId: id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_ACTIVATED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ message: 'Tenant activated', tenant });
  } catch (err) {
    logger.error('Failed to activate tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to activate tenant' });
  }
});

/**
 * DELETE /tenants/:id
 * Soft delete tenant
 */
router.delete('/:id', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      {
        status: 'deleted',
        deletedAt: new Date(),
        deletionReason: reason
      },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await auditService.log({
      userId,
      tenantId: id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_DELETED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { reason }
    });

    res.json({ message: 'Tenant deleted' });
  } catch (err) {
    logger.error('Failed to delete tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

/**
 * POST /tenants/:id/impersonate
 * Impersonate company admin (CITTAA_SUPER_ADMIN only)
 */
router.post('/:id/impersonate', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const requestId = req.requestId;

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const admin = await User.findOne({
      tenantId: id,
      role: 'COMPANY_ADMIN'
    });

    if (!admin) {
      return res.status(404).json({ error: 'No admin found for this tenant' });
    }

    const jwt = require('jsonwebtoken');
    const impersonationToken = jwt.sign(
      {
        userId: admin._id,
        email: admin.email,
        role: admin.role,
        tenantId: admin.tenantId,
        impersonatedBy: userId
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await auditService.log({
      userId,
      tenantId: id,
      role: 'CITTAA_SUPER_ADMIN',
      action: 'TENANT_IMPERSONATED',
      targetResource: 'Tenant',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { impersonatedAdminId: admin._id }
    });

    res.json({
      message: 'Impersonation token generated',
      token: impersonationToken,
      admin: {
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName
      }
    });
  } catch (err) {
    logger.error('Failed to impersonate tenant', { error: err.message });
    res.status(500).json({ error: 'Failed to impersonate' });
  }
});

module.exports = router;
