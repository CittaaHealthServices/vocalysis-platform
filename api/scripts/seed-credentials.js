/**
 * seed-credentials.js
 * ──────────────────────────────────────────────────────────
 * Creates / updates credentials for:
 *   1. Cittaa internal team  (info@cittaa.in tenant)
 *   2. Tata Steel demo tenant (50-employee cap, 90-day access)
 *
 * Usage:
 *   node api/scripts/seed-credentials.js
 *
 * Requires MONGODB_URI in environment (or .env in api/).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/vocalysis');
  console.log('✅  Connected to MongoDB\n');

  const User   = require('../src/models/User');
  const Tenant = require('../src/models/Tenant');

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────────────────

  async function upsertTenant(data) {
    let t = await Tenant.findOne({ tenantId: data.tenantId });
    if (!t) {
      t = new Tenant(data);
      await t.save();
      console.log(`  🏢  Created tenant: ${data.displayName}  (${data.tenantId})`);
    } else {
      Object.assign(t, data);
      await t.save();
      console.log(`  🏢  Updated tenant: ${data.displayName}  (${data.tenantId})`);
    }
    return t;
  }

  async function upsertUser({ email, password, role, firstName, lastName, tenantId, extra = {} }) {
    let u = await User.findOne({ email: email.toLowerCase() });
    if (!u) {
      u = new User({
        userId:    uuidv4(),
        tenantId,
        email:     email.toLowerCase(),
        role,
        firstName,
        lastName,
        isActive:  true,
        ...extra,
      });
    } else {
      u.tenantId  = tenantId;
      u.role      = role;
      u.firstName = firstName;
      u.lastName  = lastName;
      u.isActive  = true;
      Object.assign(u, extra);
    }
    await u.setPassword(password);
    await u.save();
    return u;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1.  CITTAA INTERNAL TENANT
  // ─────────────────────────────────────────────────────────────────────────

  console.log('━━━  CITTAA INTERNAL TEAM  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const cittaaTenant = await upsertTenant({
    tenantId:              'cittaa-internal',
    displayName:           'Cittaa Health Services',
    legalName:             'Cittaa Health Services Pvt Ltd',
    type:                  'clinic',
    industry:              'Healthcare Technology',
    contactEmail:          'info@cittaa.in',
    contractTier:          'enterprise',
    monthlyAssessmentQuota: 9999,
    status:                'active',
    featureFlags: {
      hrDashboard:          true,
      employeeSelfService:  true,
      apiAccess:            true,
      whiteLabel:           true,
      customBranding:       true,
      advancedAnalytics:    true,
      bulkImport:           true,
      googleIntegration:    true,
    },
  });

  const cittaaTenantId = cittaaTenant.tenantId;

  const internalTeam = [
    {
      email:     'info@cittaa.in',
      password:  'Cittaa@Admin2026!',
      role:      'CITTAA_SUPER_ADMIN',
      firstName: 'Cittaa',
      lastName:  'Admin',
    },
    {
      email:     'sairam@cittaa.in',
      password:  'Sairam@Cittaa2026!',
      role:      'CITTAA_CEO',
      firstName: 'Sairam',
      lastName:  'Cittaa',
    },
    {
      email:     'hr@cittaa.in',
      password:  'HR@Cittaa2026!',
      role:      'HR_ADMIN',
      firstName: 'Cittaa',
      lastName:  'HR',
      extra: {
        hrProfile: { canViewIndividualNames: true },
      },
    },
    {
      email:     'pratya@cittaa.in',
      password:  'Pratya@Cittaa2026!',
      role:      'CLINICAL_PSYCHOLOGIST',
      firstName: 'Pratya',
      lastName:  'Cittaa',
    },
    {
      email:     'abhijay@cittaa.in',
      password:  'Abhijay@Cittaa2026!',
      role:      'CLINICAL_PSYCHOLOGIST',
      firstName: 'Abhijay',
      lastName:  'Cittaa',
    },
  ];

  for (const u of internalTeam) {
    await upsertUser({ ...u, tenantId: cittaaTenantId });
    console.log(`  👤  ${u.role.padEnd(22)}  ${u.email}  /  ${u.password}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2.  TATA STEEL DEMO TENANT  (90-day trial, 50 employees)
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n━━━  TATA STEEL DEMO TENANT  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const trialStart = new Date();
  const trialEnd   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);   // 90 days

  const tataTenant = await upsertTenant({
    tenantId:              'tata-steel-demo',
    displayName:           'Tata Steel',
    legalName:             'Tata Steel Limited',
    type:                  'corporate',
    industry:              'Steel & Mining',
    contactEmail:          'wellness@tatasteel.com',
    contractTier:          'enterprise',
    monthlyAssessmentQuota: 50,
    employeeCount:         50,
    status:                'trial',
    contractStartDate:     trialStart,
    contractEndDate:       trialEnd,
    trial: {
      isActive:     true,
      startDate:    trialStart,
      endDate:      trialEnd,
      durationDays: 90,
      maxUsers:     55,   // 50 employees + 5 admin/HR/clinician
    },
    featureFlags: {
      hrDashboard:          true,
      employeeSelfService:  true,
      apiAccess:            false,
      whiteLabel:           false,
      customBranding:       false,
      advancedAnalytics:    true,
      bulkImport:           true,
      googleIntegration:    false,
    },
  });

  const tataTenantId = tataTenant.tenantId;

  const tataTeam = [
    {
      email:     'admin@tatasteel-demo.vocalysis.in',
      password:  'TataDemo@Admin2026!',
      role:      'COMPANY_ADMIN',
      firstName: 'Tata Steel',
      lastName:  'Admin',
    },
    {
      email:     'hr1@tatasteel-demo.vocalysis.in',
      password:  'TataDemo@HR2026!',
      role:      'HR_ADMIN',
      firstName: 'Wellness',
      lastName:  'Manager',
      extra: { hrProfile: { canViewIndividualNames: false } },
    },
    {
      email:     'hr2@tatasteel-demo.vocalysis.in',
      password:  'TataDemo@HR2_2026!',
      role:      'HR_ADMIN',
      firstName: 'HR',
      lastName:  'Coordinator',
      extra: { hrProfile: { canViewIndividualNames: false } },
    },
    {
      email:     'psychologist@tatasteel-demo.vocalysis.in',
      password:  'TataDemo@Psych2026!',
      role:      'CLINICAL_PSYCHOLOGIST',
      firstName: 'Demo',
      lastName:  'Psychologist',
    },
    {
      email:     'employee.demo@tatasteel-demo.vocalysis.in',
      password:  'TataDemo@Emp2026!',
      role:      'EMPLOYEE',
      firstName: 'Demo',
      lastName:  'Employee',
    },
  ];

  for (const u of tataTeam) {
    await upsertUser({ ...u, tenantId: tataTenantId });
    console.log(`  👤  ${u.role.padEnd(22)}  ${u.email}  /  ${u.password}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY TABLE
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CREDENTIAL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CITTAA INTERNAL  (tenant: cittaa-internal)
  ──────────────────────────────────────────
  Super Admin   info@cittaa.in            Cittaa@Admin2026!
  CEO           sairam@cittaa.in          Sairam@Cittaa2026!
  HR Admin      hr@cittaa.in              HR@Cittaa2026!
  Clinician     pratya@cittaa.in          Pratya@Cittaa2026!
  Clinician     abhijay@cittaa.in         Abhijay@Cittaa2026!

  TATA STEEL DEMO  (tenant: tata-steel-demo)
  ──────────────────────────────────────────
  Trial: 90 days  |  Employee cap: 50
  Company Admin   admin@tatasteel-demo.vocalysis.in        TataDemo@Admin2026!
  HR Manager      hr1@tatasteel-demo.vocalysis.in          TataDemo@HR2026!
  HR Coordinator  hr2@tatasteel-demo.vocalysis.in          TataDemo@HR2_2026!
  Psychologist    psychologist@tatasteel-demo.vocalysis.in TataDemo@Psych2026!
  Demo Employee   employee.demo@tatasteel-demo.vocalysis.in TataDemo@Emp2026!

  NOTE: Tata Steel employees can self-register via /register using
        tenant ID: tata-steel-demo  (up to 50 employees)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await mongoose.disconnect();
  console.log('✅  Done. Disconnected from MongoDB.');
}

main().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
