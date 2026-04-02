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
const authRoutes = require('./routes/auth.routes');
const cittaaAdminRoutes = require('./routes/cittaa-admin.routes');
const audioRoutes = require('./routes/audio.routes');
const usersRoutes = require('./routes/users.routes');
const consultationRoutes = require('./routes/consultations.routes');
const sessionRoutes = require('./routes/sessions.routes');
const employeeRoutes = require('./routes/employees.routes');
const alertRoutes = require('./routes/alerts.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const tenantRoutes = require('./routes/tenants.routes');

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());
app.use(cookieParser());

// CORS configuration — hardcoded Railway + localhost defaults + optional env override
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://striking-bravery-production-c13e.up.railway.app',
  'https://vocalysis-platform-production.up.railway.app',
  'https://vocalysis.cittaa.in',
  'https://app.vocalysis.cittaa.in',
  'https://cittaa.in',
];

const envOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  process.env.CORS_ORIGINS ||
  ''
).split(',').map(o => o.trim()).filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ORIGINS, ...envOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
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

app.get('/api/health', (req, res) => {
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
app.use('/api/auth', authRoutes);
app.use('/consultations', consultationRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/sessions', sessionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/employees', employeeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/alerts', alertRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/tenants', tenantRoutes);
app.use('/api/tenants', tenantRoutes);

// ============================================================================
// DOCUMENTATION & ADMIN ROUTES
// ============================================================================

// Swagger API documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Vocalysis Platform 2.0 API',
    version: '2.0.0',
    description: 'Complete API for Vocalysis Platform with VocaCore™ voice biomarker analysis'
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
// DEV / SEED ENDPOINTS (protected by secret token)
// ============================================================================

const _runSeed = async (req, res) => {
  const secret = req.query.secret || req.body?.secret;
  const SEED_SECRET = process.env.SEED_SECRET || 'cittaa-seed-2024';

  if (secret !== SEED_SECRET) {
    return res.status(403).json({ error: 'Invalid seed secret' });
  }

  try {
    const User   = require('./models/User');
    const Tenant = require('./models/Tenant');
    const crypto = require('crypto');

    // Create Cittaa tenant if not present
    let cittaaTenant = await Tenant.findOne({ tenantId: 'cittaa-internal' }).lean();
    if (!cittaaTenant) {
      const t = new Tenant({
        tenantId: 'cittaa-internal',
        legalName: 'Cittaa Health Services Pvt. Ltd.',
        displayName: 'Cittaa Health Services',
        status: 'active',
        subscriptionPlan: 'enterprise',
        contactEmail: 'tech@cittaa.in',
      });
      await t.save();
      cittaaTenant = t;
    }

    const SEED_USERS = [
      { email: 'sairam@cittaa.in',    firstName: 'Sairam',    lastName: 'Citaa',    role: 'CITTAA_SUPER_ADMIN' },
      { email: 'ceo@cittaa.in',       firstName: 'CEO',       lastName: 'Cittaa',   role: 'CITTAA_CEO' },
      { email: 'hr@cittaa.in',        firstName: 'Hema',      lastName: 'Swi',      role: 'HR_ADMIN' },
      { email: 'psychologist@cittaa.in', firstName: 'Dr. Priya', lastName: 'Sharma', role: 'CLINICAL_PSYCHOLOGIST' },
      { email: 'employee@cittaa.in',  firstName: 'Ravi',      lastName: 'Kumar',    role: 'EMPLOYEE' },
    ];

    const created = [];
    const skipped = [];

    for (const u of SEED_USERS) {
      const existing = await User.findOne({ email: u.email });
      if (existing) { skipped.push(u.email); continue; }

      const tempPassword = u.email.split('@')[0] + '@Vocalysis1';
      const user = new User({
        ...u,
        tenantId: 'cittaa-internal',
        isActive: true,
      });
      await user.setPassword(tempPassword);
      await user.save();
      created.push({ email: u.email, password: tempPassword, role: u.role });
    }

    res.json({
      success: true,
      message: 'Seed completed',
      created,
      skipped,
    });
  } catch (err) {
    logger.error('Seed failed', { error: err.message });
    res.status(500).json({ error: 'Seed failed: ' + err.message });
  }
};

app.get('/dev/seed', _runSeed);
app.post('/dev/seed', express.json(), _runSeed);

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
