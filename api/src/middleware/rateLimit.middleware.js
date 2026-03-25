const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');
const logger = require('../config/logger');

const globalRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rate_limit:global:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: false,
  skip: (req) => {
    return req.user?.role === 'CITTAA_SUPER_ADMIN';
  },
  handler: (req, res) => {
    logger.warn('Global rate limit exceeded', {
      ipAddress: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rate_limit:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ipAddress: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 900,
    });
  },
});

const uploadRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rate_limit:upload:',
  }),
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    return `${req.user?.tenantId}:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Upload rate limit exceeded, please try again later',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: false,
  skip: (req) => {
    return !req.user?.tenantId;
  },
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      tenantId: req.user?.tenantId,
      ipAddress: req.ip,
    });

    res.status(429).json({
      success: false,
      message: 'Upload rate limit exceeded, please try again later',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

const apiKeyRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rate_limit:apikey:',
  }),
  windowMs: (req) => 60 * 1000,
  max: (req) => {
    if (!req.apiKey?.rateLimitPerMinute) {
      return 60;
    }
    return req.apiKey.rateLimitPerMinute;
  },
  keyGenerator: (req) => {
    return req.apiKey?.keyId || req.ip;
  },
  message: {
    success: false,
    message: 'API key rate limit exceeded',
    code: 'API_KEY_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: false,
  skip: (req) => {
    return !req.apiKey;
  },
  handler: (req, res) => {
    logger.warn('API key rate limit exceeded', {
      keyId: req.apiKey?.keyId,
      tenantId: req.apiKey?.tenantId,
    });

    res.status(429).json({
      success: false,
      message: 'API key rate limit exceeded',
      code: 'API_KEY_RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

module.exports = {
  globalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  apiKeyRateLimiter,
};
