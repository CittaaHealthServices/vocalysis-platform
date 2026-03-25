const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    salt: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: [
        'CITTAA_SUPER_ADMIN',
        'COMPANY_ADMIN',
        'HR_ADMIN',
        'SENIOR_CLINICIAN',
        'CLINICAL_PSYCHOLOGIST',
        'EMPLOYEE',
        'API_CLIENT',
      ],
      required: true,
      index: true,
    },
    firstName: String,
    lastName: String,
    phone: String,
    profilePhotoUrl: String,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    dateOfBirth: Date,
    employeeId: String,
    departmentId: String,
    jobTitle: String,
    reportingManagerId: String,
    clinicianProfile: {
      rciRegistrationNumber: String,
      specialisation: String,
      yearsOfExperience: Number,
      languagesSpoken: [String],
      qualifications: [String],
    },
    hrProfile: {
      canViewIndividualNames: { type: Boolean, default: false },
      approvedByCompanyAdminAt: Date,
      managedDepartmentIds: [String],
    },
    consentRecord: {
      consentGiven: { type: Boolean, default: false },
      consentDate: Date,
      consentVersion: String,
      consentWithdrawnAt: Date,
      dataProcessingConsent: { type: Boolean, default: false },
      researchConsent: { type: Boolean, default: false },
    },
    notificationPreferences: {
      emailAlerts: { type: Boolean, default: true },
      inAppAlerts: { type: Boolean, default: true },
      whatsappAlerts: { type: Boolean, default: false },
      alertOnHighRisk: { type: Boolean, default: true },
      alertOnAssessmentComplete: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: false },
    },
    googleProfile: {
      googleId: String,
      accessToken: {
        type: String,
        select: false,
      },
      refreshToken: {
        type: String,
        select: false,
      },
      tokenExpiry: Date,
      calendarEnabled: { type: Boolean, default: false },
      email: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: Date,
    lastLoginAt: Date,
    lastLoginIp: String,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: Date,
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ userId: 1 }, { unique: true });

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.setPassword = async function (rawPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(rawPassword, salt);
  this.salt = salt;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

userSchema.methods.verifyEmailVerificationToken = function (token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.emailVerificationToken === hashedToken;
};

userSchema.methods.verifyPasswordResetToken = function (token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return (
    this.passwordResetToken === hashedToken &&
    this.passwordResetExpiry &&
    this.passwordResetExpiry > new Date()
  );
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.salt;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.mfaSecret;
  delete obj.googleProfile?.accessToken;
  delete obj.googleProfile?.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
