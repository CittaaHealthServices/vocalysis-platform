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
const authRoutes         = require('./routes/auth.routes');
const consultationRoutes = require('./routes/consultations.routes');
const sessionRoutes      = require('./routes/sessions.routes');
const employeeRoutes     = require('./routes/employees.routes');
const alertRoutes        = require('./routes/alerts.routes');
const analyticsRoutes    = require('./routes/analytics.routes');
const tenantRoutes       = require('./routes/tenants.routes');
const trialRoutes        = require('./routes/trial.routes');

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());

// Cookie parser — MUST be before any route that reads req.cookies
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
