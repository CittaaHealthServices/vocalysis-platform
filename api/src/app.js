const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { requireAuth, requireRole } = require('./middleware/auth');

// Import routes
const authRoutes          = require('./routes/auth.routes');
const consultationRoutes  = require('./routes/consultations.routes');
const sessionRoutes       = require('./routes/sessions.routes');
const employeeRoutes      = require('./routes/employees.routes');
const alertRoutes         = require('./routes/alerts.routes');
const analyticsRoutes     = require('./routes/analytics.routes');
const tenantRoutes        = require('./routes/tenants.routes');
const trialRoutes         = require('./routes/trial.routes');
const cittaaAdminRoutes   = require('./routes/cittaa-admin.routes');
const companyRoutes       = require('./routes/company.routes');
const myRoutes            = require('./routes/my.routes');
const usersRoutes         = require('./routes/users.routes');
const clinicalRoutes      = require('./routes/clinical.routes');
const eapRoutes           = require('./routes/eap.routes');
const coachingRoutes      = require('./routes/coaching.routes');
const outcomesRoutes      = require('./routes/outcomes.routes');

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());

// Cookie parser ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ MUST be before any route that reads req.cookies
app.use(cookieParser());

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.get('X-Request-ID') || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// HTTP request logging
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms', {
  stream: {
    write: (message) => logger.debug(message.trim())
  }
}));

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/detailed', requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/auth', authRoutes);
app.use('/consultations', consultationRoutes);
app.use('/sessions', sessionRoutes);
app.use('/employees', employeeRoutes);
app.use('/alerts', alertRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/tenants', tenantRoutes);
app.use('/trial', trialRoutes);
app.use('/cittaa-admin', cittaaAdminRoutes);
app.use('/company', companyRoutes);
app.use('/my', myRoutes);
app.use('/users', usersRoutes);
app.use('/clinical', clinicalRoutes);
app.use('/eap', eapRoutes);
app.use('/coaching', coachingRoutes);
app.use('/outcomes', outcomesRoutes);

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ DEV SEED (temporary ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ creates test users for all roles) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
const _seedRouter = express.Router();
_seedRouter.post('/', async (req, res) => {
  try {
    if (req.body?.secret !== 'cittaa-seed-2024') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const User   = require('./models/User');
    const Tenant = require('./models/Tenant');
    const { v4: _uuidv4 } = require('uuid');

    // ── Ensure Cittaa internal tenant exists ──────────────────────────────
    let cittaaTenant = await Tenant.findOne({ tenantId: 'cittaa-internal' });
    if (!cittaaTenant) {
      cittaaTenant = await Tenant.create({
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
          hrDashboard: true, employeeSelfService: true, apiAccess: true,
          whiteLabel: true, customBranding: true, advancedAnalytics: true,
          bulkImport: true, googleIntegration: true,
        },
      });
    }
    const cittaaTenantId = cittaaTenant.tenantId;

    // ── Cittaa internal users ─────────────────────────────────────────────
    const cittaaUsers = [
      { email: 'info@cittaa.in',    password: 'Cittaa@Admin2026!',   role: 'CITTAA_SUPER_ADMIN',    firstName: 'Cittaa',   lastName: 'Admin'    },
      { email: 'sairam@cittaa.in',  password: 'Sairam@Cittaa2026!',  role: 'CITTAA_CEO',            firstName: 'Sairam',  lastName: 'Cittaa'   },
      { email: 'hr@cittaa.in',      password: 'HR@Cittaa2026!',      role: 'HR_ADMIN',              firstName: 'Cittaa',  lastName: 'HR'       },
      { email: 'pratya@cittaa.in',  password: 'Pratya@Cittaa2026!',  role: 'CLINICAL_PSYCHOLOGIST', firstName: 'Pratya',  lastName: 'Cittaa'   },
      { email: 'abhijay@cittaa.in', password: 'Abhijay@Cittaa2026!', role: 'CLINICAL_PSYCHOLOGIST', firstName: 'Abhijay', lastName: 'Cittaa'   },
    ];

    // ── Fallback: also create legacy test users on first available tenant ─
    const fallbackTenant = await Tenant.findOne({}).lean();
    const fallbackTenantId = fallbackTenant ? (fallbackTenant.tenantId || fallbackTenant._id.toString()) : cittaaTenantId;
    const legacyUsers = [
      { email: 'hr.admin@cittaa.in',      password: 'TestPass@1234!', role: 'HR_ADMIN',              firstName: 'Test',  lastName: 'HRAdmin'   },
      { email: 'company.admin@cittaa.in', password: 'TestPass@1234!', role: 'COMPANY_ADMIN',         firstName: 'Test',  lastName: 'CompAdmin' },
      { email: 'clinician@cittaa.in',     password: 'TestPass@1234!', role: 'CLINICAL_PSYCHOLOGIST', firstName: 'Test',  lastName: 'Clinician' },
      { email: 'employee@cittaa.in',      password: 'TestPass@1234!', role: 'EMPLOYEE',              firstName: 'Demo',  lastName: 'Employee'  },
    ];

    const results = [];

    const upsert = async (u, tenantId) => {
      let userDoc = await User.findOne({ email: u.email.toLowerCase() });
      if (!userDoc) {
        userDoc = new User({
          userId: _uuidv4(), tenantId, email: u.email.toLowerCase(),
          role: u.role, firstName: u.firstName, lastName: u.lastName,
          isActive: true, isEmailVerified: true,
        });
      } else {
        userDoc.isActive = true;
        userDoc.isEmailVerified = true;
        userDoc.tenantId = tenantId;
      }
      await userDoc.setPassword(u.password);
      await userDoc.save();
      results.push({ ok: true, email: u.email, role: u.role, tenantId });
    };

    for (const u of cittaaUsers)  await upsert(u, cittaaTenantId);
    for (const u of legacyUsers)  await upsert(u, fallbackTenantId);

    res.json({ success: true, seeded: results.length, users: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use('/dev/seed', _seedRouter);

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Scheduling (HR view of upcoming assessments + consultations this week) ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
const _schedRouter = express.Router();
_schedRouter.get('/', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const Consultation = require('./models/Consultation');
    const Session      = require('./models/Session');
    const { tenantId } = req.user;
    const now     = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [upcoming, recentSessions] = await Promise.all([
      Consultation.find({ tenantId, scheduledAt: { $gte: now, $lte: weekEnd }, status: { $in: ['CONFIRMED', 'PENDING'] } })
        .populate('employeeId', 'firstName lastName email')
        .populate('clinicianId', 'firstName lastName')
        .sort({ scheduledAt: 1 }).limit(20).lean(),
      Session.find({ tenantId, createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } })
        .populate('patientId', 'firstName lastName email')
        .sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    res.json({ success: true, data: { upcoming, recentSessions } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load scheduling data' });
  }
});
app.use('/scheduling', _schedRouter);

// ============================================================================
// DOCUMENTATION & ADMIN ROUTES
// ============================================================================

// Swagger API documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Vocalysis Platform 2.0 API',
    version: '2.0.0',
    description: 'Complete API for Vocalysis Platform with VocaCoreÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ voice biomarker analysis'
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:3001',
      description: 'API Server'
    }
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'User Login',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' }
        }
      }
    }
  }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Bull Board for queue monitoring (admin only)
app.use('/admin/queues', requireAuth, requireRole(['CITTAA_SUPER_ADMIN']), (req, res, next) => {
  // Optional: Add password protection
  if (process.env.BULL_BOARD_PASSWORD) {
    const password = req.get('X-Bull-Board-Password');
    if (password !== process.env.BULL_BOARD_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
  }
  next();
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.requestId
  });

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;
