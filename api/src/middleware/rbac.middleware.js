const logger = require('../config/logger');

const ROLES = {
  CITTAA_SUPER_ADMIN: 'CITTAA_SUPER_ADMIN',
  CITTAA_CEO:         'CITTAA_CEO',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  SENIOR_CLINICIAN: 'SENIOR_CLINICIAN',
  CLINICAL_PSYCHOLOGIST: 'CLINICAL_PSYCHOLOGIST',
  EMPLOYEE: 'EMPLOYEE',
  API_CLIENT: 'API_CLIENT',
};

const ROLE_HIERARCHY = {
  CITTAA_SUPER_ADMIN: 1,
  CITTAA_CEO:         1,
  COMPANY_ADMIN: 2,
  HR_ADMIN: 3,
  SENIOR_CLINICIAN: 4,
  CLINICAL_PSYCHOLOGIST: 5,
  EMPLOYEE: 6,
  API_CLIENT: 7,
};

const expandLegacyRoles = (roles) =>
  roles.flatMap((role) => {
    if (role === 'CLINICIAN') {
      return [ROLES.SENIOR_CLINICIAN, ROLES.CLINICAL_PSYCHOLOGIST];
    }

    return role;
  });

const requireRole = (...allowedRoles) => {
  const normalizedAllowedRoles = expandLegacyRoles(allowedRoles.flat());

  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Missing user context for role check', {
        path: req.path,
        method: req.method,
      });

      return res.status(401).json({
        success: false,
        message: 'User context required',
        code: 'MISSING_USER_CONTEXT',
      });
    }

    const userRole = req.user.role;

    if (!normalizedAllowedRoles.includes(userRole)) {
      logger.warn('User role not authorized', {
        userId: req.user.userId,
        userRole,
        allowedRoles: normalizedAllowedRoles,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: normalizedAllowedRoles,
      });
    }

    next();
  };
};

const requireMinTier = (minTierLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Missing user context for tier check', {
        path: req.path,
        method: req.method,
      });

      return res.status(401).json({
        success: false,
        message: 'User context required',
        code: 'MISSING_USER_CONTEXT',
      });
    }

    const userRole = req.user.role;
    const userTierLevel = ROLE_HIERARCHY[userRole];

    if (!userTierLevel) {
      logger.error('Unknown user role in tier check', {
        userId: req.user.userId,
        userRole,
      });

      return res.status(500).json({
        success: false,
        message: 'Invalid user role',
        code: 'INVALID_USER_ROLE',
      });
    }

    if (userTierLevel > minTierLevel) {
      logger.warn('User tier insufficient', {
        userId: req.user.userId,
        userRole,
        userTierLevel,
        minTierLevel,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'Your role tier does not have sufficient access',
        code: 'INSUFFICIENT_TIER',
        requiredTier: minTierLevel,
        userTier: userTierLevel,
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireMinTier,
  ROLES,
  ROLE_HIERARCHY,
};
