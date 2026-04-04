const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ─── ErrorLog ─────────────────────────────────────────────────────────────────
//
// Captures all unhandled exceptions and significant application errors.
// Written by the global Express error handler (app.js) and by any service
// that calls ErrorLog.capture() directly.
//
// Severity guide:
//   critical — unhandled exception, process-level crash risk, 5xx server error
//   error    — expected error path but something went wrong (4xx with stack)
//   warning  — recoverable issue, validation failure, expected rejection

const errorLogSchema = new mongoose.Schema(
  {
    errorId: {
      type:    String,
      default: () => uuidv4(),
      unique:  true,
      index:   true,
    },

    // Error identity
    message: { type: String, required: true },
    name:    { type: String },                    // Error class name: TypeError, ValidationError…
    stack:   { type: String },                    // Full stack trace
    code:    { type: String },                    // Optional error code (ECONNREFUSED, etc.)

    // Classification
    service: {
      type:    String,
      enum:    ['api', 'worker', 'scheduler', 'external'],
      default: 'api',
      index:   true,
    },
    severity: {
      type:    String,
      enum:    ['critical', 'error', 'warning'],
      default: 'error',
      index:   true,
    },

    // HTTP context (populated when error came from an HTTP request)
    path:       { type: String },
    method:     { type: String },
    statusCode: { type: Number, index: true },
    requestId:  { type: String },
    userAgent:  { type: String },
    ipAddress:  { type: String },

    // User context
    userId:   { type: String, index: true },
    tenantId: { type: String, index: true },
    role:     { type: String },

    // Extra context: request body snippets, query params, job data, etc.
    // Sensitive fields (passwords, tokens) must be stripped before storing.
    metadata: { type: mongoose.Schema.Types.Mixed },

    // Resolution tracking
    resolved:   { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolution: { type: String },                 // Brief explanation of how it was fixed

    timestamp: {
      type:    Date,
      default: Date.now,
      index:   true,
    },
  },
  { timestamps: true }
);

// Compound indexes for common admin queries
errorLogSchema.index({ severity: 1, timestamp: -1 });
errorLogSchema.index({ service: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1, severity: 1, timestamp: -1 });
errorLogSchema.index({ tenantId: 1, timestamp: -1 });

// ── Static helper: strip sensitive fields from request body ──────────────────
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'confirmPassword', 'token', 'accessToken',
  'refreshToken', 'secret', 'apiKey', 'authorization', 'cookie',
  'creditCard', 'cvv', 'ssn', 'pan',
]);

function _sanitize(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = typeof v === 'object' ? _sanitize(v, depth + 1) : v;
    }
  }
  return out;
}

// ── Static helper: capture an error from a request context ───────────────────
//
// Usage:
//   await ErrorLog.capture(err, req, { severity: 'critical' });
//
errorLogSchema.statics.capture = async function (err, req, opts = {}) {
  try {
    const statusCode = err.statusCode || err.status || opts.statusCode || 500;
    const severity = opts.severity
      || (statusCode >= 500 ? 'critical' : statusCode >= 400 ? 'error' : 'warning');

    await this.create({
      message:   err.message || String(err),
      name:      err.name,
      stack:     err.stack,
      code:      err.code,
      service:   opts.service || 'api',
      severity,
      statusCode,
      path:      req?.path,
      method:    req?.method,
      requestId: req?.requestId,
      userAgent: req?.get?.('user-agent'),
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userId:    req?.user?.userId || req?.user?._id?.toString(),
      tenantId:  req?.user?.tenantId,
      role:      req?.user?.role,
      metadata:  opts.metadata || (req?.body ? _sanitize(req.body) : undefined),
    });
  } catch (writeErr) {
    // Never let error logging itself crash the app
    console.error('[ErrorLog] Failed to write error log entry:', writeErr.message);
  }
};

module.exports = mongoose.model('ErrorLog', errorLogSchema);
