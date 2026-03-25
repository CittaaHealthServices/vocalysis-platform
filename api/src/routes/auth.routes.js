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
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_EXPIRY = 15 * 60; // 15 minutes

/**
 * POST /auth/register
 * Create new user (role-based creation restrictions)
 */
router.post('/register', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, role, tenantId, password } = req.body;
    const requestId = req.requestId;
    const userRole = req.user.role;
    const userId = req.user._id;
    const userTenantId = req.user.tenantId;

    // Validate input
    if (!email || !firstName || !lastName || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate password complexity
    if (!this._isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character'
      });
    }

    // Authorization checks
    if (userRole === 'CITTAA_SUPER_ADMIN') {
      // Can create COMPANY_ADMIN
      if (role !== 'COMPANY_ADMIN') {
        return res.status(403).json({ error: 'Super admin can only create company admins' });
      }
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId required for creating company admin' });
      }
    } else if (userRole === 'COMPANY_ADMIN') {
      // Can create HR_ADMIN
      if (role !== 'HR_ADMIN' && role !== 'CLINICIAN') {
        return res.status(403).json({ error: 'Company admin can only create HR admin or clinician' });
      }
      // Use current user's tenant
      const finalTenantId = tenantId || userTenantId;
      if (finalTenantId !== userTenantId.toString()) {
        return res.status(403).json({ error: 'Cannot create users in other tenants' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to create users' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const tempPassword = crypto.randomBytes(4).toString('hex');

    // Create user
    const newUser = new User({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      role,
      tenantId: tenantId || userTenantId,
      isActive: true,
      loginAttempts: 0,
      lastLoginAt: null,
      createdBy: userId,
      createdAt: new Date()
    });

    await newUser.save();

    // Log audit
    await auditService.log({
      userId,
      tenantId: tenantId || userTenantId,
      role: userRole,
      action: 'USER_CREATED',
      targetResource: 'User',
      targetId: newUser._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
      changeSnapshot: { email, role, firstName, lastName }
    });

    // Send welcome email
    const tenant = await Tenant.findById(tenantId || userTenantId);
    await emailService.sendWelcomeEmail({
      to: email,
      name: firstName,
      loginUrl: `${process.env.PLATFORM_URL}/login`,
      tempPassword,
      companyName: tenant?.name || 'Vocalysis'
    }).catch(err => logger.error('Welcome email failed', { error: err.message }));

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
      }
    });
  } catch (err) {
    logger.error('User registration failed', { error: err.message });
    await auditService.log({
      userId: req.user._id,
      tenantId: req.user.tenantId,
      role: req.user.role,
      action: 'USER_CREATED',
      targetResource: 'User',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      outcome: 'failure',
      errorMessage: err.message
    });
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Email + password login with lockout protection
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, totpCode } = req.body;
    const requestId = req.requestId;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check lockout
    const lockoutKey = `login_lockout:${email}`;
    const isLocked = await redis.get(lockoutKey);
    if (isLocked) {
      await auditService.log({
        tenantId: null,
        action: 'LOGIN_ATTEMPT',
        targetResource: 'User',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId,
        outcome: 'failure',
        errorMessage: 'Account temporarily locked due to failed login attempts'
      });
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const attemptsKey = `login_attempts:${email}`;
      let attempts = await redis.get(attemptsKey);
      attempts = (attempts ? parseInt(attempts) : 0) + 1;

      if (attempts >= LOGIN_ATTEMPTS_LIMIT) {
        await redis.setex(lockoutKey, LOCKOUT_DURATION / 1000, '1');
        logger.warn('User locked out due to failed login attempts', { email });
      } else {
        await redis.setex(attemptsKey, 3600, attempts.toString());
      }

      await auditService.log({
        userId: user._id,
        tenantId: user.tenantId,
        role: user.role,
        action: 'LOGIN_ATTEMPT',
        targetResource: 'User',
        targetId: user._id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId,
        outcome: 'failure',
        errorMessage: 'Invalid password'
      });

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Check MFA if enabled
    if (user.mfaEnabled && !totpCode) {
      return res.status(403).json({
        error: 'MFA required',
        mfaRequired: true,
        needsTotpCode: true
      });
    }

    if (user.mfaEnabled && totpCode) {
      const isValidTotp = otplib.authenticator.check(totpCode, user.mfaSecret);
      if (!isValidTotp) {
        await auditService.log({
          userId: user._id,
          tenantId: user.tenantId,
          role: user.role,
          action: 'LOGIN_ATTEMPT',
          targetResource: 'User',
          targetId: user._id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestId,
          outcome: 'failure',
          errorMessage: 'Invalid TOTP code'
        });
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }
    }

    // Clear login attempts
    await redis.del(`login_attempts:${email}`);

    // Update last login
    user.lastLoginAt = new Date();
    user.loginAttempts = 0;
    await user.save();

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        tenantId: user.tenantId
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await auditService.log({
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      action: 'LOGIN_SUCCESS',
      targetResource: 'User',
      targetId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  } catch (err) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/refresh
 * Issue new access token using refresh cookie
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Rotate refresh token
    const newRefreshToken = jwt.sign(
      {
        userId: user._id,
        tenantId: user.tenantId
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    logger.error('Token refresh failed', { error: err.message });
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /auth/logout
 * Blacklist current access token and clear refresh cookie
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const requestId = req.requestId;

    if (token) {
      // Blacklist token in Redis
      const decoded = jwt.decode(token);
      const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
      if (ttl > 0) {
        await redis.setex(`blacklisted_token:${token}`, ttl, '1');
      }
    }

    res.clearCookie('refreshToken');

    await auditService.log({
      userId: req.user._id,
      tenantId: req.user.tenantId,
      role: req.user.role,
      action: 'LOGOUT',
      targetResource: 'User',
      targetId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout failed', { error: err.message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /auth/forgot-password
 * Generate password reset token and send email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const requestId = req.requestId;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY * 1000);
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.PLATFORM_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordReset({
      to: email,
      name: user.firstName,
      resetUrl,
      expiresIn: RESET_TOKEN_EXPIRY / 60
    }).catch(err => logger.error('Password reset email failed', { error: err.message }));

    await auditService.log({
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      targetResource: 'User',
      targetId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ message: 'If email exists, reset link will be sent' });
  } catch (err) {
    logger.error('Forgot password failed', { error: err.message });
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /auth/reset-password
 * Validate reset token and set new password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const requestId = req.requestId;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }

    if (!this._isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 10 characters with uppercase, lowercase, number, and special character'
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Set new password
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    await user.save();

    await auditService.log({
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      targetResource: 'User',
      targetId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Password reset failed', { error: err.message });
    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * POST /auth/mfa/setup
 * Generate TOTP secret and QR code
 */
router.post('/auth/mfa/setup', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // Generate TOTP secret
    const secret = otplib.authenticator.generateSecret();
    const otpauth_url = otplib.authenticator.keyuri(user.email, 'Vocalysis', secret);

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauth_url);

    res.json({
      secret,
      qrCode,
      manualEntryKey: secret
    });
  } catch (err) {
    logger.error('MFA setup failed', { error: err.message });
    res.status(500).json({ error: 'MFA setup failed' });
  }
});

/**
 * POST /auth/mfa/verify
 * Verify TOTP code and enable MFA
 */
router.post('/auth/mfa/verify', requireAuth, async (req, res) => {
  try {
    const { secret, totpCode } = req.body;
    const requestId = req.requestId;

    if (!secret || !totpCode) {
      return res.status(400).json({ error: 'Secret and TOTP code required' });
    }

    // Verify TOTP code
    const isValid = otplib.authenticator.check(totpCode, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid TOTP code' });
    }

    // Enable MFA
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        mfaEnabled: true,
        mfaSecret: secret
      },
      { new: true }
    );

    await auditService.log({
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      action: 'MFA_ENABLED',
      targetResource: 'User',
      targetId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    logger.error('MFA verification failed', { error: err.message });
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

/**
 * POST /auth/google
 * Redirect to Google OAuth consent screen
 */
router.get('/auth/google', requireAuth, (req, res) => {
  try {
    const url = googleService.getConnectUrl(req.user._id, req.user.tenantId);
    res.json({ url });
  } catch (err) {
    logger.error('Google OAuth URL generation failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const requestId = req.requestId;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Decode state
    const { userId, tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for tokens
    const tokens = await googleService.exchangeCode(code);

    // Store tokens in user's Google profile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        googleProfile: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date,
          connectedAt: new Date()
        }
      },
      { new: true }
    );

    await auditService.log({
      userId,
      tenantId,
      role: user.role,
      action: 'GOOGLE_CONNECTED',
      targetResource: 'User',
      targetId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId
    });

    // Redirect to success page or return token
    res.redirect(`${process.env.PLATFORM_URL}/settings/integrations?google=connected`);
  } catch (err) {
    logger.error('Google OAuth callback failed', { error: err.message });
    res.redirect(`${process.env.PLATFORM_URL}/settings/integrations?google=failed&error=${err.message}`);
  }
});

/**
 * Helper: Validate password complexity
 */
function _isValidPassword(password) {
  if (password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
}

module.exports = router;
