const crypto = require('crypto');
const ApiKey = require('../models/ApiKey.model');
const Tenant = require('../models/Tenant.model');
const redis = require('../config/redis');
const logger = require('../config/logger');

const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKeyHeader = req.headers['x-vocalysis-key'];

    if (!apiKeyHeader) {
      return res.status(401).json({
        success: false,
        message: 'API key is required in X-Vocalysis-Key header',
        code: 'MISSING_API_KEY',
      });
    }

    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');

    const apiKey = await ApiKey.findOne({ keyHash }).select(
      '+keyHash'
    );

    if (!apiKey) {
      logger.warn('Invalid API key used', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    if (!apiKey.isActive) {
      logger.warn('Inactive API key used', {
        keyId: apiKey.keyId,
        tenantId: apiKey.tenantId,
        ipAddress: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: 'API key is inactive',
        code: 'INACTIVE_API_KEY',
      });
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      logger.warn('Expired API key used', {
        keyId: apiKey.keyId,
        tenantId: apiKey.tenantId,
        expiresAt: apiKey.expiresAt,
      });

      return res.status(401).json({
        success: false,
        message: 'API key has expired',
        code: 'EXPIRED_API_KEY',
      });
    }

    if (apiKey.revokedAt) {
      logger.warn('Revoked API key used', {
        keyId: apiKey.keyId,
        tenantId: apiKey.tenantId,
      });

      return res.status(401).json({
        success: false,
        message: 'API key has been revoked',
        code: 'REVOKED_API_KEY',
      });
    }

    if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0) {
      if (!apiKey.ipWhitelist.includes(req.ip)) {
        logger.warn('API key IP not whitelisted', {
          keyId: apiKey.keyId,
          requestIp: req.ip,
          whitelistedIps: apiKey.ipWhitelist,
        });

        return res.status(403).json({
          success: false,
          message: 'IP address not whitelisted for this API key',
          code: 'IP_NOT_WHITELISTED',
        });
      }
    }

    const tenant = await Tenant.findOne({ tenantId: apiKey.tenantId });

    if (!tenant) {
      logger.error('Tenant not found for API key', {
        keyId: apiKey.keyId,
        tenantId: apiKey.tenantId,
      });

      return res.status(500).json({
        success: false,
        message: 'Tenant configuration error',
        code: 'TENANT_NOT_FOUND',
      });
    }

    if (tenant.status !== 'active') {
      logger.warn('API key from non-active tenant', {
        keyId: apiKey.keyId,
        tenantId: apiKey.tenantId,
        tenantStatus: tenant.status,
      });

      return res.status(403).json({
        success: false,
        message: `Tenant is ${tenant.status}`,
        code: 'TENANT_NOT_ACTIVE',
      });
    }

    const rateLimitKey = `api_key_rate_limit:${apiKey.keyId}`;
    const currentCount = await redis.incr(rateLimitKey);

    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60);
    }

    const perMinuteLimit = apiKey.rateLimit.perMinute;

    if (currentCount > perMinuteLimit) {
      logger.warn('API key rate limit exceeded (per minute)', {
        keyId: apiKey.keyId,
        currentCount,
        limit: perMinuteLimit,
      });

      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
    }

    await ApiKey.updateOne(
      { keyId: apiKey.keyId },
      {
        lastUsedAt: new Date(),
        lastUsedIp: req.ip,
      }
    );

    req.apiKey = {
      keyId: apiKey.keyId,
      tenantId: apiKey.tenantId,
      rateLimitPerMinute: apiKey.rateLimit.perMinute,
      rateLimitPerDay: apiKey.rateLimit.perDay,
      isActive: apiKey.isActive,
      allowedEndpoints: apiKey.permissions?.allowedEndpoints,
      allowedMethods: apiKey.permissions?.allowedMethods,
    };

    req.user = {
      tenantId: apiKey.tenantId,
      role: 'API_CLIENT',
      apiKeyId: apiKey.keyId,
    };

    next();
  } catch (error) {
    logger.error('API key authentication failed', {
      error: error.message,
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      message: 'API key authentication failed',
      code: 'API_KEY_AUTH_ERROR',
    });
  }
};

module.exports = {
  authenticateApiKey,
};
