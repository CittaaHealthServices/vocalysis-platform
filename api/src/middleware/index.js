const {
  verifyAccessToken,
  verifyRefreshToken,
  checkBlacklist,
  requireAuth,
} = require('./auth.middleware');

const {
  requireRole,
  requireMinTier,
  ROLES,
  ROLE_HIERARCHY,
} = require('./rbac.middleware');

const {
  enforceTenantScope,
  attachTenant,
} = require('./tenant.middleware');

const {
  authenticateApiKey,
} = require('./apiKey.middleware');

const {
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  apiKeyRateLimiter,
} = require('./rateLimit.middleware');

const {
  auditLog,
} = require('./audit.middleware');

const {
  audioUpload,
} = require('./upload.middleware');

module.exports = {
  verifyAccessToken,
  verifyRefreshToken,
  checkBlacklist,
  requireAuth,
  requireRole,
  requireMinTier,
  ROLES,
  ROLE_HIERARCHY,
  enforceTenantScope,
  attachTenant,
  authenticateApiKey,
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  apiKeyRateLimiter,
  auditLog,
  audioUpload,
};
