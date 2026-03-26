const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const otplib = require('otplib');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const googleService = require('../services/googleService');
const redis = require('../utils/redis');
const { requireAuth, requireRole } = require('../middleware/auth');

// Constants
const LOGIN_ATTEMPTS_LIMIT = 5;
const LOCKOUT_DURATION = 15 * 60; // seconds
const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_EXPIRY_SECONDS = 900;
const REFRESH_TOKEN_EXPIRY = '7d';

// JWT secrets — consistent with auth.middleware.js
const JWT_ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || process.env.JWT_SECRET  || 'access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

/**
 * Helper: validate password complexity
 */
function _isValidPassword(password) {
  if (!password || password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
}

/**
 * Helper: build safe public user object
 */
function safeUser(user) {
  return {
    id:        user._id,
    userId:    user.userId,
    email:     user.email,
    firstName: user.firstName,
    lastName:  user.lastName,
    role:      user.role,
    tenantId:  user.tenantId,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/register
 */
router.post('/register', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, role, tenantId, password } = req.body;
    const requestId    = req.requestId;
    const userRole     = req.user.role;
    const userId       = req.user.userId;
    const userTenantId = req.user.tenantId;

    if (!email || !firstName || !lastName || !role || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!_isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character'
      });
    }

    const allowedRoles = {
      CITTAA_SUPER_ADMIN: ['COMPANY_ADMIN', 'CITTAA_SUPER_ADMIN'],
      COMPANY_ADMIN:      ['HR_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'],
    };

    if (!allowedRoles[userRole]) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions to create users' });
    }
    if (!allowedRoles[userRole].includes(role)) {
      return res.status(403).json({ success: false, message: `Your role cannot create a ${role} user` });
    }
    if (userRole === 'CITTAA_SUPER_ADMIN' && !tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required when creating company admins' });
    }

    const finalTenantId = tenantId || userTenantId;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    const newUser = new User({
      email:       email.toLowerCase(),
      firstName,
      lastName,
      role,
      tenantId:    finalTenantId,
      isActive:    true,
      isEmailVerified: false,
      loginAttempts: 0,
      consentRecord: { consentGiven: false, dataProcessingConsent: false },
      notificationPreferences: { emailAlerts: true, inAppAlerts: true },
    });
    await newUser.setPassword(password);
    await newUser.save();

    await auditService.log({
      userId, tenantId: finalTenantId, role: userRole,
      action: 'USER_CREATED', targetResource: 'User', targetId: newUser._id,
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId,
      changeSnapshot: { email, role, firstName, lastName }
    }).catch(() => {});

    const tenant = await Tenant.findOne({ tenantId: finalTenantId });
    await emailService.sendWelcomeEmail({
      to: email,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app'}/login`,
      tempPassword: password,
      companyName: tenant?.displayName || tenant?.legalName || 'Vocalysis'
    }).catch(err => logger.error('Welcome email failed', { error: err.message }));

    res.status(201).json({
      success: true,
      data: { user: safeUser(newUser), message: 'User created successfully' }
    });
  } catch (err) {
    logger.error('User registration failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, totpCode } = req.body;
    const requestId = req.requestId;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // Rate-limit / lockout check
    const lockoutKey = `login_lockout:${email.toLowerCase()}`;
    const isLocked = await redis.get(lockoutKey).catch(() => null);
    if (isLocked) {
      return res.status(429).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked. Try again in 15 minutes.'
      });
    }

    // IMPORTANT: select passwordHash (field has select:false in schema)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +salt +mfaSecret');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify password using model method (handles passwordHash field)
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      const attemptsKey = `login_attempts:${email.toLowerCase()}`;
      const prev = parseInt(await redis.get(attemptsKey).catch(() => '0') || '0');
      const attempts = prev + 1;

      if (attempts >= LOGIN_ATTEMPTS_LIMIT) {
        await redis.setex(lockoutKey, LOCKOUT_DURATION, '1').catch(() => {});
      } else {
        await redis.setex(attemptsKey, 3600, String(attempts)).catch(() => {});
      }

      await auditService.log({
        userId: user._id, tenantId: user.tenantId, role: user.role,
        action: 'LOGIN_ATTEMPT', targetResource: 'User', targetId: user._id,
        ipAddress: req.ip, userAgent: req.get('user-agent'), requestId,
        outcome: 'failure', errorMessage: 'Invalid password'
      }).catch(() => {});

      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // MFA check
    if (user.mfaEnabled && !totpCode) {
      return res.status(403).json({
        success: false,
        code: 'MFA_REQUIRED',
        message: 'Two-factor authentication required',
        mfaRequired: true,
      });
    }

    if (user.mfaEnabled && totpCode) {
      const isValidTotp = otplib.authenticator.check(totpCode, user.mfaSecret);
      if (!isValidTotp) {
        await auditService.log({
          userId: user._id, tenantId: user.tenantId, role: user.role,
          action: 'LOGIN_ATTEMPT', targetResource: 'User', targetId: user._id,
          ipAddress: req.ip, userAgent: req.get('user-agent'), requestId,
          outcome: 'failure', errorMessage: 'Invalid TOTP code'
        }).catch(() => {});
        return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
      }
    }

    // Success — clear failed attempts
    await redis.del(`login_attempts:${email.toLowerCase()}`).catch(() => {});

    user.lastLoginAt  = new Date();
    user.loginAttempts = 0;
    await user.save();

    const jti = uuidv4();
    const accessToken = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role, tenantId: user.tenantId, jti },
      JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, jti: uuidv4() },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000
    });

    await auditService.log({
      userId: user._id, tenantId: user.tenantId, role: user.role,
      action: 'LOGIN_SUCCESS', targetResource: 'User', targetId: user._id,
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: safeUser(user),
      }
    });
  } catch (err) {
    logger.error('Login failed', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/verify
 * Re-issue access token from existing refresh cookie (called on page load)
 */
router.post('/verify', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user    = await User.findOne({ userId: decoded.userId });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const jti = uuidv4();
    const accessToken = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role, tenantId: user.tenantId, jti },
      JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: safeUser(user),
      }
    });
  } catch (err) {
    logger.warn('Verify failed', { error: err.message });
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token not found' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user    = await User.findOne({ userId: decoded.userId });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const jti = uuidv4();
    const newAccessToken = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role, tenantId: user.tenantId, jti },
      JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, jti: uuidv4() },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn:   ACCESS_TOKEN_EXPIRY_SECONDS,
        user: safeUser(user),
      }
    });
  } catch (err) {
    logger.error('Token refresh failed', { error: err.message });
    res.status(401).json({ success: false, message: 'Token refresh failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/logout
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token && req.user?.jti) {
      const decoded = jwt.decode(token);
      const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
      if (ttl > 0) {
        await redis.setex(`blacklisted_tokens:${req.user.jti}`, ttl, '1').catch(() => {});
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    await auditService.log({
      userId: req.user.userId, tenantId: req.user.tenantId, role: req.user.role,
      action: 'LOGOUT', targetResource: 'User',
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId
    }).catch(() => {});

    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    logger.error('Logout failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, data: { message: 'If that email is registered, a reset link has been sent.' } });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const platformUrl = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';
    const resetUrl = `${platformUrl}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordReset({
      to: email,
      name: user.firstName,
      resetUrl,
      expiresIn: 60
    }).catch(err => logger.error('Password reset email failed', { error: err.message }));

    await auditService.log({
      userId: user._id, tenantId: user.tenantId, role: user.role,
      action: 'PASSWORD_RESET_REQUESTED', targetResource: 'User', targetId: user._id,
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId
    }).catch(() => {});

    res.json({ success: true, data: { message: 'If that email is registered, a reset link has been sent.' } });
  } catch (err) {
    logger.error('Forgot password failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password required' });
    }

    if (!_isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken:  tokenHash,
      passwordResetExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    await user.setPassword(password);
    user.passwordResetToken  = undefined;
    user.passwordResetExpiry = undefined;
    user.loginAttempts       = 0;
    await user.save();

    await auditService.log({
      userId: user._id, tenantId: user.tenantId, role: user.role,
      action: 'PASSWORD_RESET_COMPLETED', targetResource: 'User', targetId: user._id,
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId
    }).catch(() => {});

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (err) {
    logger.error('Password reset failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * POST /auth/mfa/setup
 */
router.post('/mfa/setup', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const secret = otplib.authenticator.generateSecret();
    const otpauthUrl = otplib.authenticator.keyuri(user.email, 'Vocalysis', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    res.json({ success: true, data: { secret, qrCode, manualEntryKey: secret } });
  } catch (err) {
    logger.error('MFA setup failed', { error: err.message });
    res.status(500).json({ success: false, message: 'MFA setup failed' });
  }
});

/**
 * POST /auth/mfa/verify
 */
router.post('/mfa/verify', requireAuth, async (req, res) => {
  try {
    const { secret, totpCode } = req.body;

    if (!secret || !totpCode) {
      return res.status(400).json({ success: false, message: 'Secret and TOTP code required' });
    }

    const isValid = otplib.authenticator.check(totpCode, secret);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
    }

    await User.findOneAndUpdate({ userId: req.user.userId }, { mfaEnabled: true, mfaSecret: secret });

    await auditService.log({
      userId: req.user.userId, tenantId: req.user.tenantId, role: req.user.role,
      action: 'MFA_ENABLED', targetResource: 'User',
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId
    }).catch(() => {});

    res.json({ success: true, data: { message: 'MFA enabled successfully' } });
  } catch (err) {
    logger.error('MFA verification failed', { error: err.message });
    res.status(500).json({ success: false, message: 'MFA verification failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * GET /auth/google
 */
router.get('/google', requireAuth, (req, res) => {
  try {
    const url = googleService.getConnectUrl(req.user.userId, req.user.tenantId);
    res.json({ success: true, data: { url } });
  } catch (err) {
    logger.error('Google OAuth URL generation failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to generate OAuth URL' });
  }
});

/**
 * GET /auth/google/callback
 */
router.get('/google/callback', async (req, res) => {
  const platformUrl = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${platformUrl}/settings/integrations?google=failed&error=missing_params`);
    }

    const { userId, tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const tokens = await googleService.exchangeCode(code);

    const user = await User.findOneAndUpdate(
      { userId },
      {
        googleProfile: {
          accessToken:     tokens.access_token,
          refreshToken:    tokens.refresh_token,
          tokenExpiry:     tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          calendarEnabled: true,
        }
      },
      { new: true }
    );

    await auditService.log({
      userId, tenantId, role: user?.role,
      action: 'GOOGLE_CONNECTED', targetResource: 'User',
      ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId
    }).catch(() => {});

    res.redirect(`${platformUrl}/settings/integrations?google=connected`);
  } catch (err) {
    logger.error('Google OAuth callback failed', { error: err.message });
    res.redirect(`${platformUrl}/settings/integrations?google=failed&error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
