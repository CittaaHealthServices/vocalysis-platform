# Vocalysis Platform 2.0 API - File Manifest

## Complete File Listing

### Root Level
- **package.json** - NPM dependencies and scripts (24 production dependencies)
- **BUILD_SUMMARY.md** - Project overview and build summary
- **FILE_MANIFEST.md** - This file

### Configuration Files (src/config/)
All configuration files are production-ready with environment variable support.

| File | Purpose | Key Features |
|------|---------|--------------|
| **db.js** | MongoDB Connection | Connection pooling (100), retry logic, graceful shutdown, event handlers |
| **redis.js** | Redis Client | Exponential backoff reconnect, error handling, SIGTERM/SIGINT handlers |
| **logger.js** | Winston Logger | Sensitive field redaction, JSON/colorized formatting, file rotation |

### Mongoose Models (src/models/)
All models include appropriate indexes and timestamps.

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **Tenant.model.js** | tenantId, status, contractTier, featureFlags | Multi-tenant management |
| **User.model.js** | userId, role, mfaSecret, googleProfile | User auth & profiles |
| **Employee.model.js** | employeeId, status, wellnessProfile | Employee wellness tracking |
| **Session.model.js** | sessionId, extractedFeatures, vocacoreResults | Assessment sessions |
| **Alert.model.js** | alertId, severity, status, employeeId | Risk alert management |
| **ApiKey.model.js** | keyId, keyHash, rateLimit, isActive | API key management |
| **AuditLog.model.js** | auditLogId, action, userId, changeSnapshot | Audit trail |
| **HealthCheckLog.model.js** | service, status, metrics | Service monitoring |
| **WebhookDeliveryLog.model.js** | deliveryId, eventType, status | Webhook tracking |
| **Consultation.model.js** | consultationId, googleMeet, googleCalendar | Google Meet scheduling |

### Middleware Files (src/middleware/)
All middleware are production-grade with comprehensive error handling.

| Middleware | Exports | Purpose |
|-----------|---------|---------|
| **auth.middleware.js** | verifyAccessToken, verifyRefreshToken, checkBlacklist, requireAuth | JWT authentication |
| **rbac.middleware.js** | requireRole, requireMinTier, ROLES, ROLE_HIERARCHY | Role-based access control |
| **tenant.middleware.js** | enforceTenantScope, attachTenant | Tenant isolation |
| **apiKey.middleware.js** | authenticateApiKey | API key validation |
| **rateLimit.middleware.js** | globalRateLimiter, authRateLimiter, uploadRateLimiter, apiKeyRateLimiter | Rate limiting |
| **audit.middleware.js** | auditLog | Audit logging factory |
| **upload.middleware.js** | audioUpload | File upload handling |
| **index.js** | All exports | Central middleware export |

## Model Schema Specifications

### Tenant.model.js
- **Required**: tenantId, displayName, legalName, type, contactEmail, contractTier, monthlyAssessmentQuota
- **Enums**: type (corporate, hospital, school, clinic, api_client), status (active, suspended, trial, expired, onboarding), contractTier (starter, professional, enterprise), billingCycle (monthly, quarterly, annual)
- **Indexes**: { tenantId: 1 } unique, { status: 1 }, { contractTier: 1 }
- **Features**: Google integration, webhook config, custom branding, feature flags, API keys, departments

### User.model.js
- **Required**: tenantId, email, role
- **Enums**: role (7 types), gender, status
- **Methods**: comparePassword, setPassword, generateEmailVerificationToken, generatePasswordResetToken, toJSON (strips secrets)
- **Indexes**: { tenantId: 1, email: 1 } unique, { tenantId: 1, role: 1 }, { userId: 1 } unique
- **Security**: Password hashing, token generation, MFA support, OAuth fields (select: false)

### Employee.model.js
- **Required**: tenantId, employeeId, fullName, email, departmentId
- **Enums**: status (active, inactive, on_leave, offboarded), riskLevel (green, yellow, orange, red, unknown)
- **Indexes**: { tenantId: 1, departmentId: 1 }, { tenantId: 1, status: 1 }, { tenantId: 1, userId: 1 } unique
- **Tracking**: Import batch tracking, wellness profile, assessment schedule

### Session.model.js
- **Fields**: 80+ fields across 8 categories (audio, extracted features, vococore results, clinician inputs, etc.)
- **Categories**:
  - audioMetadata (file info, processing status)
  - extractedFeatures (prosody, voice, acoustic, linguistic, temporal)
  - vocacoreResults (risk level, dimensional scores, recommendations)
  - clinicianInputs (notes, observations, interventions)
  - employeeWellnessOutput (personalized recommendations)
  - hrAggregateContribution (department metrics)
- **Indexes**: { tenantId: 1, sessionDate: -1 }, { tenantId: 1, patientId: 1, sessionDate: -1 }, { tenantId: 1, 'vocacoreResults.overallRiskLevel': 1 }

### Alert.model.js
- **Enums**: alertType (8 types), severity (low, medium, high, critical), status (new, acknowledged, in_progress, resolved, escalated)
- **Tracking**: Assignment, acknowledgment, resolution, escalation
- **Indexes**: { tenantId: 1, status: 1, triggeredAt: -1 }, { tenantId: 1, employeeId: 1 }

### ApiKey.model.js
- **Security**: keyHash (unique, indexed, SHA-256), keyHashPrefix (public)
- **Indexes**: { keyHash: 1 } unique, { tenantId: 1, isActive: 1 }
- **Features**: Rate limits, IP whitelist, usage stats, webhook, permissions, expiry
- **Statics**: hashKey, getKeyPrefix

### AuditLog.model.js
- **Actions**: 40+ action types (LOGIN, CREATE, UPDATE, DELETE, etc.)
- **Tracking**: Before/after snapshots, HTTP status, error details, request metadata
- **Indexes**: { tenantId: 1, timestamp: -1 }, { userId: 1, timestamp: -1 }, { action: 1, timestamp: -1 }

### HealthCheckLog.model.js
- **Services**: MongoDB, Redis, Vocoware, Google OAuth, Email, API Server
- **Metrics**: Response time, connection pool, active connections, uptime
- **Indexes**: { service: 1, checkedAt: -1 }, { status: 1, checkedAt: -1 }

### WebhookDeliveryLog.model.js
- **Events**: 16+ event types (session.created, assessment.completed, alert.triggered, etc.)
- **Tracking**: Delivery status, HTTP code, response body, attempt count, retry scheduling
- **Headers**: Event type, delivery ID, timestamp, signature
- **Indexes**: { tenantId: 1, eventType: 1, createdAt: -1 }, { deliveryStatus: 1, nextRetryAt: 1 }

### Consultation.model.js
- **Enums**: consultationType (pre_assessment, post_assessment, follow_up, crisis, routine), mode (online, offline), status (scheduled, confirmed, in_progress, completed, cancelled, no_show)
- **Google Integration**: Meet link, Calendar event, Attendee management
- **Tracking**: Reminders, attachments, metadata, followup relationships
- **Indexes**: { tenantId: 1, scheduledAt: -1 }, { tenantId: 1, employeeId: 1 }, { tenantId: 1, clinicianId: 1 }, { tenantId: 1, sessionId: 1 }

## Middleware Specifications

### auth.middleware.js
- **verifyAccessToken**: Extracts Bearer token, validates JWT_ACCESS_SECRET, attaches req.user
- **verifyRefreshToken**: Extracts from httpOnly cookie, validates JWT_REFRESH_SECRET
- **checkBlacklist**: Checks Redis SET for revoked tokens by jti
- **requireAuth**: Combined middleware (verifyAccessToken + checkBlacklist)

### rbac.middleware.js
- **ROLES**: 7 role constants exported
- **ROLE_HIERARCHY**: Numeric tier system (1=CITTAA_SUPER_ADMIN, 7=API_CLIENT)
- **requireRole(...roles)**: Checks req.user.role is in allowed list
- **requireMinTier(level)**: Checks role hierarchy level

### tenant.middleware.js
- **enforceTenantScope**: Sets req.tenantFilter
  - Super admin: allows override via query/body
  - Others: enforces req.user.tenantId
- **attachTenant**: Fetches Tenant from DB, validates status, attaches to req.tenant

### apiKey.middleware.js
- **authenticateApiKey**: Reads X-Vocalysis-Key header
  - Hashes with SHA-256
  - Validates active, not expired, not revoked
  - Checks IP whitelist
  - Enforces per-minute rate limit
  - Updates lastUsedAt
  - Sets req.user.role = 'API_CLIENT'

### rateLimit.middleware.js
- **globalRateLimiter**: 300 req/15min per IP (Redis store)
- **authRateLimiter**: 10 req/15min per IP (for /auth routes)
- **uploadRateLimiter**: 5 req/min per tenant
- **apiKeyRateLimiter**: Per-key limits from req.apiKey.rateLimit

### audit.middleware.js
- **auditLog(action, targetResource)**: Middleware factory
  - Logs after response sent
  - Captures: userId, tenantId, action, statusCode, outcome
  - Sanitizes sensitive fields
  - Extracts browser/OS from User-Agent
  - Never logs request body content

### upload.middleware.js
- **audioUpload**: Multer configuration
  - Storage: memory (no disk)
  - File filter: audio/* or octet-stream
  - Type validation with file-type library
  - Max size: 50MB
  - Field name: 'audio'

## Environment Variables

```bash
MONGODB_URI              # MongoDB connection string (default: mongodb://localhost:27017/vocalysis)
REDIS_URL               # Redis connection URL (default: redis://localhost:6379)
JWT_ACCESS_SECRET       # Required for JWT signing
JWT_REFRESH_SECRET      # Required for refresh token signing
NODE_ENV                # development | production | staging
LOG_LEVEL               # info | warn | error | debug
```

## Security Features

✓ Password hashing with bcrypt (10 salt rounds)
✓ JWT token management with expiry
✓ Token blacklist with Redis
✓ Rate limiting (global, auth, upload, API key)
✓ API key hashing (SHA-256)
✓ Sensitive field redaction in logs
✓ Tenant isolation enforcement
✓ RBAC with role hierarchy
✓ IP whitelist support
✓ File type validation
✓ Connection pooling
✓ Graceful shutdown handlers

## Database Optimization

✓ Comprehensive indexing (30+ indexes across models)
✓ Connection pooling: min 10, max 100
✓ Retry logic with exponential backoff
✓ Sparse unique indexes for optional fields
✓ Compound indexes for common queries
✓ TTL indexes support (for future implementation)

## Production Checklist

- [x] All required fields are marked as required
- [x] All enums are explicitly defined
- [x] Sensitive data is excluded from responses (select: false)
- [x] Comprehensive error handling
- [x] Logging integration throughout
- [x] Security best practices implemented
- [x] Database optimization complete
- [x] Rate limiting configured
- [x] Audit trail established
- [x] Graceful shutdown implemented
- [x] Environment variable configuration
- [x] No hardcoded secrets
- [x] No TODO comments
- [x] No placeholder code

## Total Statistics

- **Total Files**: 24
- **Total Lines of Code**: ~3,500+
- **Models**: 10
- **Middleware**: 7
- **Config Files**: 3
- **Export/Index Files**: 2
- **Documentation Files**: 2
