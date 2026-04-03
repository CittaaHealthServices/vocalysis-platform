const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const otplib = require('otplib');
const QRCode = require('qrcode');

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const googleService = require('../services/googleService');
const redis = require('../utils/redis');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const LOGIN_ATTEMPTS_LIMIT = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60;
const RESET_TOKEN_EXPIRY_SECONDS = 15 * 60;

const parseDurationToSeconds = (value, fallbackSeconds) => {
  if (!value) {
    return fallbackSeconds;
  }

  if (/^\d+$/.test(String(value))) {
    return Number(value);
  }

  const match = String(value).match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };

  return amount * multipliers[unit];
};

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = parseDurationToSeconds(ACCESS_TOKEN_EXPIRY, 15 * 60);
const REFRESH_TOKEN_EXPIRY_SECONDS = parseDurationToSeconds(REFRESH_TOKEN_EXPIRY, 7 * 24 * 60 * 60);

const buildUserPayload = (user) => ({
  id: String(user._id),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  tenantId: user.tenantId,
});

const buildAuthResponse = (user, accessToken) => ({
  success: true,
  data: {
    accessToken,
    user: buildUserPayload(user),
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  },
});

const isValidPassword = (password) => {
  if (typeof password !== 'string' || password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
};

const createAccessToken = (user) =>
  jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      jti: uuidv4(),
    },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'access-secret',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    {
      userId: String(user._id),
      tenantId: user.tenantId,
      jti: uuidv4(),
    },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
  });
};

const getRefreshUser = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    return null;
  }

  return user;
};

router.post('/register', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, role, tenantId, password } = req.body;
    const requestId = req.requestId;
    const actorRole = req.user.role;
    const actorUserId = req.user.userId;
    const actorTenantId = req.user.tenantId;

    if (!email || !firstName || !lastName || !role || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character',
      });
    }

    const normalizedRole = role === 'CLINICIAN' ? 'CLINICAL_PSYCHOLOGIST' : role;
    let targetTenantId = tenantId || actorTenantId;

    if (actorRole === 'CITTAA_SUPER_ADMIN') {
      if (normalizedRole !== 'COMPANY_ADMIN') {
        return res.status(403).json({ success: false, error: 'Super admin can only create company admins' });
      }

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId required for creating company admin' });
      }
    } else if (actorRole === 'COMPANY_ADMIN') {
      if (!['HR_ADMIN', 'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST'].includes(normalizedRole)) {
        return res.status(403).json({ success: false, error: 'Company admin can only create HR admins or clinicians' });
      }

      targetTenantId = actorTenantId;
    } else {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to create users' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase(), tenantId: targetTenantId });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'User with this email already exists' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const newUser = new User({
      email: email.toLowerCase(),
      firstName,
      lastName,
      role: normalizedRole,
      tenantId: targetTenantId,
      isActive: true,
      createdBy: actorUserId,
      lastLoginAt: null,
      loginAttempts: 0,
    });

    await newUser.setPassword(password);
    await newUser.save();

    await auditService.log({
      userId: actorUserId,
      tenantId: targetTenantId,
      role: actorRole,
      action: 'USER_CREATE',
      targetResource: 'user',
      targetId: String(newUser._id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
    });

    const tenant = await Tenant.findOne({ tenantId: targetTenantId });
    await emailService.sendWelcomeEmail({
      to: newUser.email,
      name: newUser.firstName,
      loginUrl: `${process.env.PLATFORM_URL || process.env.CLIENT_URL || ''}/login`,
      tempPassword,
      companyName: tenant?.displayName || tenant?.legalName || 'Vocalysis',
    }).catch((error) => logger.error('Welcome email failed', { error: error.message }));

    return res.status(201).json({
      success: true,
      data: {
        user: buildUserPayload(newUser),
      },
    });
  } catch (error) {
    logger.error('User registration failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, totpCode } = req.body;
    const requestId = req.requestId;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const normalizedEmail = email.toLowerCase();
    const lockoutKey = `login_lockout:${normalizedEmail}`;
    const attemptsKey = `login_attempts:${normalizedEmail}`;

    const isLocked = await redis.get(lockoutKey);
    if (isLocked) {
      return res.status(429).json({
        success: false,
        error: 'Account temporarily locked. Try again later.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +mfaSecret');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      const existingAttempts = Number((await redis.get(attemptsKey)) || 0) + 1;

      if (existingAttempts >= LOGIN_ATTEMPTS_LIMIT) {
        await redis.setex(lockoutKey, LOCKOUT_DURATION_SECONDS, '1');
      } else {
        await redis.setex(attemptsKey, 3600, String(existingAttempts));
      }

      await auditService.log({
        userId: String(user._id),
        tenantId: user.tenantId,
        role: user.role,
        action: 'USER_LOGIN',
        targetResource: 'user',
        targetId: String(user._id),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId,
        outcome: 'failure',
        errorMessage: 'Invalid password',
      });

      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account is deactivated' });
    }

    if (user.mfaEnabled && !totpCode) {
      return res.status(403).json({
        success: false,
        error: 'MFA required',
        code: 'MFA_REQUIRED',
      });
    }

    if (user.mfaEnabled && !otplib.authenticator.check(totpCode, user.mfaSecret)) {
      return res.status(401).json({ success: false, error: 'Invalid TOTP code' });
    }

    await redis.del(attemptsKey);
    user.lastLoginAt = new Date();
    user.loginAttempts = 0;
    await user.save();

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    await auditService.log({
      userId: String(user._id),
      tenantId: user.tenantId,
      role: user.role,
      action: 'USER_LOGIN',
      targetResource: 'user',
      targetId: String(user._id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
    });

    return res.json(buildAuthResponse(user, accessToken));
  } catch (error) {
    logger.error('Login failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token not found' });
    }

    const user = await getRefreshUser(refreshToken);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);
    setRefreshCookie(res, newRefreshToken);

    return res.json(buildAuthResponse(user, newAccessToken));
  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    return res.status(401).json({ success: false, error: 'Token refresh failed' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await getRefreshUser(refreshToken);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const accessToken = createAccessToken(user);
    return res.json(buildAuthResponse(user, accessToken));
  } catch (error) {
    logger.error('Auth verification failed', { error: error.message });
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    if (req.token) {
      const decoded = jwt.decode(req.token);
      const ttl = decoded?.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 0;
      if (ttl > 0) {
        await redis.setex(`blacklisted_token:${req.token}`, ttl, '1');
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    await auditService.log({
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
      action: 'USER_LOGOUT',
      targetResource: 'user',
      targetId: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetToken');
    if (!user) {
      return res.json({ success: true, message: 'If email exists, reset link will be sent' });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const resetUrl = `${process.env.PLATFORM_URL || process.env.CLIENT_URL || ''}/reset-password/${resetToken}`;
    await emailService.sendPasswordReset({
      to: user.email,
      name: user.firstName,
      resetUrl,
      expiresIn: RESET_TOKEN_EXPIRY_SECONDS / 60,
    }).catch((error) => logger.error('Password reset email failed', { error: error.message }));

    return res.json({ success: true, message: 'If email exists, reset link will be sent' });
  } catch (error) {
    logger.error('Forgot password failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, error: 'Token and password required' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character',
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpiry: { $gt: new Date() },
    }).select('+passwordResetToken');

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    await user.setPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.loginAttempts = 0;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

router.post('/mfa/setup', requireAuth, async (req, res) => {
  try {
    const secret = otplib.authenticator.generateSecret();
    const user = await User.findById(req.user.userId);
    const otpauthUrl = otplib.authenticator.keyuri(user.email, 'Vocalysis', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return res.json({
      success: true,
      data: {
        secret,
        qrCode,
        manualEntryKey: secret,
      },
    });
  } catch (error) {
    logger.error('MFA setup failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'MFA setup failed' });
  }
});

router.post('/mfa/verify', requireAuth, async (req, res) => {
  try {
    const { secret, totpCode } = req.body;

    if (!secret || !totpCode) {
      return res.status(400).json({ success: false, error: 'Secret and TOTP code required' });
    }

    if (!otplib.authenticator.check(totpCode, secret)) {
      return res.status(400).json({ success: false, error: 'Invalid TOTP code' });
    }

    await User.findByIdAndUpdate(req.user.userId, {
      mfaEnabled: true,
      mfaSecret: secret,
    });

    return res.json({ success: true, message: 'MFA enabled successfully' });
  } catch (error) {
    logger.error('MFA verification failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'MFA verification failed' });
  }
});

router.get('/google', requireAuth, (req, res) => {
  try {
    const url = googleService.getConnectUrl(req.user.userId, req.user.tenantId);
    return res.json({ success: true, data: { url } });
  } catch (error) {
    logger.error('Google OAuth URL generation failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to generate OAuth URL' });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ success: false, error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const tokens = await googleService.exchangeCode(code);

    await User.findByIdAndUpdate(userId, {
      googleProfile: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date,
        connectedAt: new Date(),
      },
    });

    return res.redirect(`${process.env.PLATFORM_URL || process.env.CLIENT_URL || ''}/settings/integrations?google=connected`);
  } catch (error) {
    logger.error('Google OAuth callback failed', { error: error.message });
    return res.redirect(`${process.env.PLATFORM_URL || process.env.CLIENT_URL || ''}/settings/integrations?google=failed`);
  }
});

module.exports = router;
