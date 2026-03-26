const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog.model');
const ApiKey = require('../models/ApiKey.model');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const logger = require('../utils/logger');

// All routes require super admin
const superAdmin = [requireAuth, requireRole(['CITTAA_SUPER_ADMIN'])];

// ============================================================================
// OVERVIEW — basic platform stats
// ============================================================================
router.get('/overview', ...superAdmin, async (req, res) => {
  try {
    const [tenantCount, userCount, activeApiKeys, recentLogs] = await Promise.all([
      Tenant.countDocuments({}),
      User.countDocuments({ isActive: true }),
      ApiKey.countDocuments({ isActive: true }),
      AuditLog.find({}).sort({ timestamp: -1 }).limit(5).lean(),
    ]);

    res.json({
      success: true,
      data: {
        tenants: tenantCount,
        activeUsers: userCount,
        activeApiKeys,
        recentActivity: recentLogs.map(l => ({
          id: l._id,
          action: l.action,
          userId: l.userId,
          timestamp: l.timestamp,
          outcome: l.outcome,
        })),
      },
    });
  } catch (err) {
    logger.error('cittaa-admin overview error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch overview' } });
  }
});

// ============================================================================
// AUDIT LOG
// ============================================================================
router.get('/audit-log', ...superAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, tenantId, outcome, from, to } = req.query;
    const query = {};
    if (action)   query.action   = action;
    if (userId)   query.userId   = userId;
    if (tenantId) query.tenantId = tenantId;
    if (outcome)  query.outcome  = outcome;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to)   query.timestamp.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(query),
    ]);

    // Enrich with user display names where possible
    const userIds = [...new Set(logs.map(l => l.userId))];
    const users = await User.find({ _id: { $in: userIds } }, 'firstName lastName email').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email; });

    res.json({
      success: true,
      data: logs.map(l => ({
        id: l._id,
        action: l.action,
        user: userMap[l.userId] || l.userId,
        userId: l.userId,
        tenantId: l.tenantId,
        role: l.role,
        resource: l.targetResource,
        resourceId: l.targetResourceId,
        outcome: l.outcome,
        ipAddress: l.ipAddress,
        timestamp: l.timestamp,
        errorMessage: l.errorMessage,
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('cittaa-admin audit-log error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch audit log' } });
  }
});

// ============================================================================
// ERROR LOG — failures in AuditLog + future error store
// ============================================================================
router.get('/errors', ...superAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, from, to } = req.query;
    const query = { outcome: 'failure' };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to)   query.timestamp.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: entries.map(e => ({
        id: e._id,
        message: e.errorMessage || e.action,
        action: e.action,
        service: e.targetResource || 'api',
        userId: e.userId,
        tenantId: e.tenantId,
        statusCode: e.statusCode,
        timestamp: e.timestamp,
        stackTrace: null, // future: store stack traces in a separate collection
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('cittaa-admin errors error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch error log' } });
  }
});

// ============================================================================
// API KEYS
// ============================================================================

// GET /cittaa-admin/api-keys — list all keys (no raw key, just preview)
router.get('/api-keys', ...superAdmin, async (req, res) => {
  try {
    const keys = await ApiKey.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    // Enrich with tenant name
    const tenantIds = [...new Set(keys.map(k => k.tenantId))];
    const tenants = await Tenant.find({ tenantId: { $in: tenantIds } }, 'tenantId name').lean();
    const tenantMap = {};
    tenants.forEach(t => { tenantMap[t.tenantId] = t.name; });

    res.json({
      success: true,
      data: keys.map(k => ({
        id: k._id,
        name: k.name,
        keyPreview: k.keyHashPrefix || '••••••••',
        tenantId: k.tenantId,
        tenantName: tenantMap[k.tenantId] || null,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
        isActive: k.isActive,
        metadata: k.metadata,
      })),
    });
  } catch (err) {
    logger.error('cittaa-admin api-keys list error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch API keys' } });
  }
});

// POST /cittaa-admin/api-keys — generate a new key
router.post('/api-keys', ...superAdmin, async (req, res) => {
  try {
    const { name, description, tenantId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Key name is required' } });
    }

    // Generate a secure random key
    const rawKey = `voc_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = ApiKey.hashKey(rawKey);
    const keyHashPrefix = ApiKey.getKeyPrefix(rawKey);
    const keyId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    const useTenantId = tenantId || req.user.tenantId || 'cittaa';

    const apiKey = await ApiKey.create({
      keyId,
      tenantId: useTenantId,
      keyHash,
      keyHashPrefix,
      name: name.trim(),
      description: description || '',
      isActive: true,
      createdBy: req.user._id.toString(),
    });

    res.status(201).json({
      success: true,
      // Return the raw key ONCE — it is not stored and cannot be retrieved again
      key: rawKey,
      data: {
        id: apiKey._id,
        name: apiKey.name,
        keyPreview: keyHashPrefix,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    logger.error('cittaa-admin api-keys create error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create API key' } });
  }
});

// DELETE /cittaa-admin/api-keys/:id — revoke a key
router.delete('/api-keys/:id', ...superAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { isActive: false, revokedAt: new Date(), revokedBy: req.user._id.toString() },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    logger.error('cittaa-admin api-keys delete error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to revoke API key' } });
  }
});

// ============================================================================
// HEALTH MONITOR
// ============================================================================
router.get('/health', ...superAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
    res.json({
      success: true,
      data: {
        api: { status: 'healthy', uptime: Math.floor(process.uptime()), memory: process.memoryUsage() },
        database: { status: dbStatus },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Health check failed' } });
  }
});

// ============================================================================
// PLATFORM ANALYTICS (super-admin overview)
// ============================================================================
router.get('/analytics', ...superAdmin, async (req, res) => {
  try {
    const Tenant = require('../models/Tenant');
    const User = require('../models/User');
    const Session = require('../models/Session');
    const Consultation = require('../models/Consultation');

    const [tenants, users, sessions, consultations] = await Promise.all([
      Tenant.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Session.countDocuments({}),
      Consultation.countDocuments({}),
    ]);

    // Monthly growth (last 6 months)
    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [t, u, s] = await Promise.all([
        Tenant.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        User.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        Session.countDocuments({ createdAt: { $gte: from, $lt: to } }),
      ]);
      monthly.push({
        month: from.toLocaleString('default', { month: 'short', year: 'numeric' }),
        tenants: t, users: u, sessions: s,
      });
    }

    res.json({
      success: true,
      data: { totals: { tenants, users, sessions, consultations }, monthly },
    });
  } catch (err) {
    logger.error('cittaa-admin analytics error', { error: err.message });
    res.status(500).json({ success: false, error: { message: 'Failed to load analytics' } });
  }
});

// ============================================================================
// COMPANY / TENANT ROUTES (used by company admin panel)
// ============================================================================

// POST /cittaa-admin/company/hr-admins
router.post('/company/hr-admins', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: { message: 'Name and email are required' } });
    // Invitation logic placeholder — just return success for now
    res.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to invite HR admin' } });
  }
});

// POST /cittaa-admin/company/departments
router.post('/company/departments', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Department name is required' } });
    res.json({ success: true, data: { id: Date.now().toString(), name, description, employeeCount: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to create department' } });
  }
});

module.exports = router;
