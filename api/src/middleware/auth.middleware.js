const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const logger = require('../config/logger');

const verifyAccessToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token missing or invalid format',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access-secret');

    req.user = {
      _id: decoded.userId,
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
      jti: decoded.jti,
    };

    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Access token expired', {
        error: error.message,
      });
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid access token', {
        error: error.message,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid access token',
        code: 'INVALID_TOKEN',
      });
    }

    logger.error('Access token verification failed', {
      error: error.message,
    });

    return res.status(401).json({
      success: false,
      message: 'Token verification failed',
      code: 'TOKEN_VERIFICATION_FAILED',
    });
  }
};

const verifyRefreshToken = (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token missing',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');

    req.refreshTokenData = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      jti: decoded.jti,
    };

    next();
  } catch (error) {
    logger.warn('Refresh token verification failed', {
      error: error.message,
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
};

const checkBlacklist = async (req, res, next) => {
  try {
    if (!req.token || !req.user?.jti) {
      return next();
    }

    const blacklistedByJti = req.user.jti
      ? await redis.exists(`blacklisted_tokens:${req.user.jti}`)
      : 0;
    const blacklistedByToken = req.token
      ? await redis.exists(`blacklisted_token:${req.token}`)
      : 0;

    if (blacklistedByJti || blacklistedByToken) {
      logger.warn('Blacklisted token used', {
        userId: req.user.userId,
        jti: req.user.jti,
      });

      return res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    next();
  } catch (error) {
    logger.error('Token blacklist check failed', {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: 'Token verification failed',
      code: 'TOKEN_CHECK_ERROR',
    });
  }
};

const requireAuth = [verifyAccessToken, checkBlacklist];

module.exports = {
  verifyAccessToken,
  verifyRefreshToken,
  checkBlacklist,
  requireAuth,
};
