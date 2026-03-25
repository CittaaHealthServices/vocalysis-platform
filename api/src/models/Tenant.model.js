const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const tenantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: /^[a-z0-9-]+$/,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    legalName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['corporate', 'hospital', 'school', 'clinic', 'api_client'],
      required: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    employeeCount: {
      type: Number,
      min: 0,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contractStartDate: Date,
    contractEndDate: Date,
    contractTier: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly',
    },
    monthlyAssessmentQuota: {
      type: Number,
      required: true,
      min: 1,
    },
    usedAssessmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    featureFlags: {
      hrDashboard: { type: Boolean, default: false },
      employeeSelfService: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      bulkImport: { type: Boolean, default: false },
      googleIntegration: { type: Boolean, default: false },
    },
    customBranding: {
      logoUrl: String,
      primaryColor: { type: String, match: /^#[0-9A-F]{6}$/i },
      secondaryColor: { type: String, match: /^#[0-9A-F]{6}$/i },
      platformName: String,
      customDomain: String,
      emailFromName: String,
    },
    webhookConfig: {
      url: String,
      secret: { type: String, select: false },
      events: [String],
      isActive: { type: Boolean, default: false },
      lastDeliveredAt: Date,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'expired', 'onboarding'],
      default: 'onboarding',
      index: true,
    },
    onboardedBy: String,
    onboardedAt: Date,
    suspensionReason: String,
    suspendedAt: Date,
    suspendedBy: String,
    departments: [
      {
        deptId: { type: String, default: () => uuidv4() },
        name: { type: String, required: true },
        headCount: Number,
        assignedHRAdminIds: [String],
      },
    ],
    apiKeys: [
      {
        keyId: { type: String, default: () => uuidv4() },
        keyHashPrefix: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: Date,
        isActive: { type: Boolean, default: true },
        rateLimit: {
          perMinute: { type: Number, default: 60 },
          perDay: { type: Number, default: 10000 },
        },
        description: String,
      },
    ],
    googleConfig: {
      serviceAccountEmail: String,
      calendarId: String,
      meetOrganizerEmail: String,
      autoCreateMeetLinks: { type: Boolean, default: false },
      defaultConsultationDurationMins: { type: Number, default: 30 },
    },
  },
  {
    timestamps: true,
  }
);

tenantSchema.index({ tenantId: 1 }, { unique: true });
tenantSchema.index({ status: 1 });
tenantSchema.index({ contractTier: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
