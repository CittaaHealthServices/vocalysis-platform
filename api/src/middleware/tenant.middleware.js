const Tenant = require('../models/Tenant.model');
const logger = require('../config/logger');
const { ROLES } = require('./rbac.middleware');

const enforceTenantScope = (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn('Missing user context in tenant scope enforcement', {
        path: req.path,
        method: req.method,
      });

      return res.status(401).json({
        success: false,
        message: 'User context required',
        code: 'MISSING_USER_CONTEXT',
      });
    }

    if (req.user.role === ROLES.CITTAA_SUPER_ADMIN) {
      const overrideTenantId = req.query.tenantId || req.body?.tenantId;
      if (overrideTenantId) {
        req.tenantFilter = { tenantId: overrideTenantId };
        logger.debug('Super admin override tenant filter', {
          userId: req.user.userId,
          overrideTenantId,
        });
      } else {
        req.tenantFilter = {};
      }
    } else {
      req.tenantFilter = { tenantId: req.user.tenantId };
    }

    next();
  } catch (error) {
    logger.error('Tenant scope enforcement failed', {
      error: error.message,
      userId: req.user?.userId,
    });

    return res.status(500).json({
      success: false,
      message: 'Tenant scope check failed',
      code: 'TENANT_SCOPE_ERROR',
    });
  }
};

const attachTenant = async (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn('Missing user context in tenant attachment', {
        path: req.path,
        method: req.method,
      });

      return res.status(401).json({
        success: false,
        message: 'User context required',
        code: 'MISSING_USER_CONTEXT',
      });
    }

    const tenantIdToFetch = req.query.tenantId || req.user.tenantId;

    const tenant = await Tenant.findOne({ tenantId: tenantIdToFetch });

    if (!tenant) {
      logger.warn('Tenant not found', {
        tenantId: tenantIdToFetch,
        userId: req.user.userId,
      });

      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
    }

    if (tenant.status === 'suspended') {
      logger.warn('Attempting to access suspended tenant', {
        tenantId: tenantIdToFetch,
        userId: req.user.userId,
      });

      return res.status(403).json({
        success: false,
        message: 'This tenant account has been suspended',
        code: 'TENANT_SUSPENDED',
        suspensionReason: tenant.suspensionReason,
      });
    }

    if (tenant.status === 'expired') {
      logger.warn('Attempting to access expired tenant', {
        tenantId: tenantIdToFetch,
        userId: req.user.userId,
      });

      return res.status(403).json({
        success: false,
        message: 'This tenant account has expired',
        code: 'TENANT_EXPIRED',
      });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    logger.error('Tenant attachment failed', {
      error: error.message,
      userId: req.user?.userId,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to attach tenant',
      code: 'TENANT_ATTACHMENT_ERROR',
    });
  }
};

module.exports = {
  enforceTenantScope,
  attachTenant,
};
