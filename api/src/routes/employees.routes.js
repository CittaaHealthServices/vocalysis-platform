const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parse');
const User = require('../models/User');
const Session = require('../models/Session');
const Tenant = require('../models/Tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const Bull = require('bull');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage() });
const bulkImportQueue = new Bull('bulk-employee-import', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

/**
 * GET /employees
 * List employees (scoped by role)
 */
router.get('/', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const userRole = req.user.role;
    const requestId = req.requestId;

    let query = {
      tenantId,
      role: 'EMPLOYEE'
    };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.isActive = status === 'active';
    }

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email department isActive createdAt lastAssessmentDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEES_LISTED',
      targetResource: 'Employee',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Failed to list employees', { error: err.message });
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

/**
 * POST /employees
 * Add single employee
 */
router.post('/', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { email, firstName, lastName, department } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, firstName, and lastName required' });
    }

    // Check if employee already exists
    const existing = await User.findOne({ email, tenantId });
    if (existing) {
      return res.status(409).json({ error: 'Employee with this email already exists' });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const employee = new User({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      role: 'EMPLOYEE',
      tenantId,
      department,
      isActive: true,
      createdBy: userId,
      createdAt: new Date()
    });

    await employee.save();

    // Send welcome email
    const tenant = await Tenant.findById(tenantId);
    await emailService.sendWelcomeEmail({
      to: email,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL}/login`,
      tempPassword,
      companyName: tenant?.name || 'Vocalysis'
    }).catch(err => logger.error('Welcome email failed', { error: err.message }));

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEE_CREATED',
      targetResource: 'Employee',
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { email, firstName, lastName, department }
    });

    res.status(201).json({
      message: 'Employee added successfully',
      employee: {
        id: employee._id,
        email,
        firstName,
        lastName,
        department
      }
    });
  } catch (err) {
    logger.error('Failed to add employee', { error: err.message });
    res.status(500).json({ error: 'Failed to add employee' });
  }
});

/**
 * GET /employees/:id
 * Get employee profile
 */
router.get('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const userRole = req.user.role;
    const requestId = req.requestId;

    const employee = await User.findById(id).select('-password');

    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get assessment statistics
    const assessmentCount = await Session.countDocuments({
      employeeId: id,
      status: 'completed'
    });

    const lastAssessment = await Session.findOne({
      employeeId: id,
      status: 'completed'
    }).sort({ createdAt: -1 });

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEE_VIEWED',
      targetResource: 'Employee',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      employee,
      stats: {
        totalAssessments: assessmentCount,
        lastAssessmentDate: lastAssessment?.createdAt || null
      }
    });
  } catch (err) {
    logger.error('Failed to fetch employee', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

/**
 * PUT /employees/:id
 * Update employee details
 */
router.put('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, department, email } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const employee = await User.findById(id);

    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const originalData = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department,
      email: employee.email
    };

    // Update fields
    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (department) employee.department = department;
    if (email && email !== employee.email) {
      const existing = await User.findOne({ email, tenantId });
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      employee.email = email;
    }

    await employee.save();

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEE_UPDATED',
      targetResource: 'Employee',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { before: originalData, after: { firstName, lastName, department, email } }
    });

    res.json({
      message: 'Employee updated',
      employee
    });
  } catch (err) {
    logger.error('Failed to update employee', { error: err.message });
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

/**
 * DELETE /employees/:id
 * Offboard employee
 */
router.delete('/:id', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requestId = req.requestId;

    const employee = await User.findById(id);

    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Mark as inactive instead of deleting
    employee.isActive = false;
    employee.offboardedAt = new Date();
    employee.offboardingReason = reason;
    await employee.save();

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEE_OFFBOARDED',
      targetResource: 'Employee',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { reason }
    });

    res.json({ message: 'Employee offboarded' });
  } catch (err) {
    logger.error('Failed to offboard employee', { error: err.message });
    res.status(500).json({ error: 'Failed to offboard employee' });
  }
});

/**
 * GET /employees/:id/sessions
 * Get employee's assessment history
 */
router.get('/:id/sessions', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN', 'CLINICIAN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const userRole = req.user.role;
    const requestId = req.requestId;

    const employee = await User.findById(id);
    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find({ employeeId: id, tenantId })
        .select('status createdAt vocacoreResults employeeWellnessOutput')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Session.countDocuments({ employeeId: id, tenantId })
    ]);

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'EMPLOYEE_SESSIONS_VIEWED',
      targetResource: 'Session',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Failed to fetch employee sessions', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * POST /employees/bulk-import
 * Bulk import employees from CSV
 */
router.post('/bulk-import', requireAuth, requireRole(['COMPANY_ADMIN']), upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file required' });
    }

    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const userRole = req.user.role;
    const requestId = req.requestId;
    const batchId = crypto.randomUUID();

    // Queue bulk import job
    await bulkImportQueue.add({
      batchId,
      csvBuffer: req.file.buffer,
      tenantId,
      userId,
      requestId
    }, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    await auditService.log({
      userId,
      tenantId,
      role: userRole,
      action: 'BULK_IMPORT_STARTED',
      targetResource: 'Employee',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { batchId, fileSize: req.file.size }
    });

    res.json({
      message: 'Bulk import queued',
      batchId
    });
  } catch (err) {
    logger.error('Failed to queue bulk import', { error: err.message });
    res.status(500).json({ error: 'Failed to queue bulk import' });
  }
});

/**
 * Bulk import job processor
 */
bulkImportQueue.process(async (job) => {
  const { batchId, csvBuffer, tenantId, userId, requestId } = job.data;

  try {
    const records = [];
    const parser = csv.parse(csvBuffer.toString(), {
      columns: true,
      skip_empty_lines: true
    });

    for await (const record of parser) {
      records.push(record);
    }

    let imported = 0;
    let failed = 0;
    const errors = [];

    for (const record of records) {
      try {
        const { email, firstName, lastName, department } = record;

        if (!email || !firstName || !lastName) {
          failed++;
          errors.push(`Row ${imported + failed}: Missing required fields`);
          continue;
        }

        const existing = await User.findOne({ email, tenantId });
        if (existing) {
          failed++;
          errors.push(`Row ${imported + failed}: Email already exists`);
          continue;
        }

        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const employee = new User({
          email,
          firstName,
          lastName,
          password: hashedPassword,
          role: 'EMPLOYEE',
          tenantId,
          department,
          isActive: true,
          createdBy: userId,
          createdAt: new Date()
        });

        await employee.save();
        imported++;
      } catch (err) {
        failed++;
        errors.push(`Row ${imported + failed}: ${err.message}`);
      }
    }

    logger.info('Bulk import completed', {
      batchId,
      imported,
      failed,
      total: records.length
    });

    await auditService.log({
      userId,
      tenantId,
      role: 'SYSTEM',
      action: 'BULK_IMPORT_COMPLETED',
      targetResource: 'Employee',
      requestId,
      changeSnapshot: { batchId, imported, failed, total: records.length }
    });

    return {
      batchId,
      imported,
      failed,
      total: records.length,
      errors: errors.slice(0, 10) // Return first 10 errors
    };
  } catch (err) {
    logger.error('Bulk import failed', { error: err.message, batchId });
    throw err;
  }
});

/**
 * GET /employees/import/:batchId
 * Check bulk import progress
 */
router.get('/import/:batchId', requireAuth, async (req, res) => {
  try {
    const { batchId } = req.params;

    const job = await bulkImportQueue.getJob(batchId);

    if (!job) {
      return res.status(404).json({ error: 'Import batch not found' });
    }

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      batchId,
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue
    });
  } catch (err) {
    logger.error('Failed to check import progress', { error: err.message });
    res.status(500).json({ error: 'Failed to check progress' });
  }
});

/**
 * POST /employees/:id/invite
 * Send assessment invitation
 */
router.post('/:id/invite', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const requestId = req.requestId;

    const employee = await User.findById(id);
    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const clinician = await User.findById(userId);

    // Send assessment invitation
    const assessmentUrl = `${process.env.PLATFORM_URL}/assess`;
    await emailService.sendAssessmentInvite({
      employee,
      clinicianName: clinician.firstName + ' ' + clinician.lastName,
      assessmentUrl,
      scheduledAt
    });

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'ASSESSMENT_INVITED',
      targetResource: 'Employee',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { scheduledAt }
    });

    res.json({ message: 'Assessment invitation sent' });
  } catch (err) {
    logger.error('Failed to send invitation', { error: err.message });
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

/**
 * POST /employees/:id/schedule
 * Set/update assessment schedule
 */
router.post('/:id/schedule', requireAuth, requireRole(['HR_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency, nextAssessmentDate } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user._id;
    const requestId = req.requestId;

    const employee = await User.findById(id);
    if (!employee || employee.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    employee.assessmentSchedule = {
      frequency, // 'weekly', 'monthly', 'quarterly'
      nextAssessmentDate: new Date(nextAssessmentDate)
    };

    await employee.save();

    await auditService.log({
      userId,
      tenantId,
      role: req.user.role,
      action: 'ASSESSMENT_SCHEDULE_SET',
      targetResource: 'Employee',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { frequency, nextAssessmentDate }
    });

    res.json({ message: 'Assessment schedule updated' });
  } catch (err) {
    logger.error('Failed to set schedule', { error: err.message });
    res.status(500).json({ error: 'Failed to set schedule' });
  }
});

module.exports = router;
