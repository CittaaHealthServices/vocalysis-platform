# Vocalysis Platform 2.0 - Complete API Implementation

## Overview
Full production-quality implementation of the Vocalysis Platform API with integrated VocaCore™ voice biomarker analysis engine, comprehensive route handlers, and enterprise-grade services layer.

## Directory Structure
```
/sessions/exciting-youthful-feynman/vocalysis-platform/api/src/
├── services/
│   ├── googleService.js          # Google Calendar + Meet integration
│   ├── vocacoreEngine.js         # VocaCore™ Gemini-based analysis
│   ├── featureExtractionService.js # Audio feature extraction
│   ├── alertEngine.js            # Alert evaluation & management
│   ├── emailService.js           # Email delivery with templates
│   ├── pdfGenerator.js           # Session/HR report PDF generation
│   └── auditService.js           # Comprehensive audit logging
├── routes/
│   ├── auth.routes.js            # Authentication & authorization
│   ├── consultations.routes.js   # Consultation scheduling
│   ├── sessions.routes.js        # Assessment sessions
│   ├── employees.routes.js       # Employee management
│   ├── alerts.routes.js          # Alert management
│   ├── analytics.routes.js       # Dashboard analytics
│   └── tenants.routes.js         # Tenant management
├── app.js                        # Express app factory
└── server.js                     # Server initialization
```

## Services Implementation

### 1. Google Service (`googleService.js`)
**Purpose:** OAuth2 integration with Google Calendar and Google Meet

**Key Methods:**
- `setCredentials(accessToken, refreshToken)` - Set OAuth credentials
- `getAuthUrl(scopes)` - Generate OAuth consent URL
- `getConnectUrl(userId, tenantId)` - Generate state-encoded auth URL
- `exchangeCode(code)` - Exchange authorization code for tokens
- `refreshAccessToken(refreshToken)` - Refresh expired tokens
- `createConsultationEvent({...})` - Create calendar event with Meet link
- `updateConsultationEvent({...})` - Update existing event
- `cancelConsultationEvent({...})` - Cancel event with notifications
- `getFreeBusy({...})` - Query free/busy slots
- `listEvents({...})` - List upcoming events
- `_computeFreeSlots(busySlots, timeMin, timeMax)` - Compute available slots within working hours (9am-6pm IST)

**Features:**
- Automatic Google Meet link generation
- Free/busy slot calculation
- 30-minute increment scheduling
- Notification delivery to all attendees
- Token refresh handling
- Error recovery with comprehensive logging

### 2. VocaCore Engine (`vocacoreEngine.js`)
**Purpose:** Voice biomarker analysis using Gemini 1.5 Pro

**Key Methods:**
- `analyze(featureVector)` - Analyze acoustic features
- `_buildAnalysisPrompt(features)` - Construct numerical analysis prompt
- `_parseResponse(text)` - Extract and validate JSON response
- `_fallbackScore(features, latencyMs)` - Deterministic rule-based scoring fallback

**Output Structure:**
```json
{
  "depression_score": 0-100,
  "anxiety_score": 0-100,
  "stress_score": 0-100,
  "emotional_stability_score": 0-100,
  "confidence_score": 0-100,
  "biomarker_findings": {
    "pitch": {"finding": "...", "severity": "low|moderate|high"},
    "speech_rate": {...},
    "vocal_quality": {...},
    "energy_level": {...},
    "rhythm_stability": {...}
  },
  "clinical_flags": [...],
  "recommended_followup_weeks": N,
  "alert_trigger": boolean,
  "overall_risk_level": "low|moderate|high|critical",
  "engineVersion": "VocaCore™ 2.0",
  "inferenceLatencyMs": N,
  "fallbackUsed": boolean
}
```

**Key Features:**
- Gemini 1.5 Pro model integration
- JSON-only response format
- Field validation and normalization
- Fallback deterministic scoring
- Inference latency tracking
- Error handling with graceful degradation

### 3. Feature Extraction Service (`featureExtractionService.js`)
**Purpose:** Extract acoustic features from audio

**Key Methods:**
- `extract(audioBuffer, filename)` - Call VocaCore service extraction endpoint
- `validateAudioBuffer(buffer, expectedMimeType)` - Validate audio file

**Features:**
- HTTP form-data submission to VocaCore service
- 50MB file size limit
- MIME type validation
- Comprehensive error messaging
- 2-minute timeout handling

### 4. Alert Engine (`alertEngine.js`)
**Purpose:** Alert evaluation, creation, and management

**Key Methods:**
- `evaluateSession(session, tenant)` - Evaluate scores against thresholds
- `getActiveAlerts(tenantId, filters)` - Paginated alert retrieval
- `acknowledgeAlert(alertId, userId, note)` - Mark alert acknowledged
- `escalateAlert(alertId, escalatedTo, reason)` - Escalate alert
- `resolveAlert(alertId, resolvedBy, resolutionSummary)` - Resolve alert
- `getAlertStats(tenantId)` - Dashboard alert statistics
- `getSuspiciousActivity(tenantId)` - Detect suspicious patterns

**Alert Thresholds:**
- Depression: high ≥70, critical ≥85
- Anxiety: high ≥65, critical ≥80
- Stress: high ≥75, critical ≥85

**Features:**
- Automatic alert creation on threshold breach
- Email notifications to HR admins
- Status lifecycle: active → acknowledged/escalated → resolved
- Comprehensive audit logging
- No database failures affect application

### 5. Email Service (`emailService.js`)
**Purpose:** Transactional email delivery with branded templates

**Key Methods:**
- `sendEmail({to, subject, html, text})` - Base send method
- `sendAssessmentInvite({employee, clinicianName, assessmentUrl, scheduledAt})` - Assessment invitation
- `sendAlertNotification({to, alert, employee, tenantName})` - Alert notification
- `sendConsultationInvite({to, consultation, meetLink, calendarLink})` - Consultation scheduling
- `sendWelcomeEmail({to, name, loginUrl, tempPassword, companyName})` - New user welcome
- `sendPasswordReset({to, name, resetUrl, expiresIn})` - Password reset
- `sendWeeklyHRReport({to, hrAdmin, reportData, tenantName})` - HR analytics report
- `sendConsultationReminder({to, consultation, minutesBefore})` - Meeting reminder
- `sendAlertEscalationNotification({to, alert, employee, reason})` - Escalation notification

**Features:**
- Nodemailer integration (SMTP)
- HTML + plain text variants
- Branded footer with logo/company name
- VocaCore™ branding (no Google/Gemini references)
- Professional template styling
- Graceful error handling (non-blocking)

### 6. PDF Generator (`pdfGenerator.js`)
**Purpose:** Generate clinical and HR reports in PDF format

**Key Methods:**
- `generateSessionReport(session, patient, clinician, tenant)` - Patient assessment report
- `generateHRReport(analytics, tenant, dateRange)` - Aggregate HR wellness report

**Session Report Sections:**
- Header with tenant branding
- Patient information (anonymizable)
- VocaCore™ scores with ASCII gauge visualizations
- Biomarker findings with severity indicators
- Clinical flags
- Clinician notes
- Recommendations
- Footer with disclaimer

**HR Report Sections:**
- Executive summary
- Assessment metrics
- Alert statistics
- Department breakdown
- Wellness trends
- HR recommendations

**Features:**
- PDFKit-based generation
- Gauge visualization using Unicode characters
- Severity color coding (red/orange/green)
- Report anonymization options
- Comprehensive footer disclaimers
- Performance-optimized rendering

### 7. Audit Service (`auditService.js`)
**Purpose:** Comprehensive action logging and compliance tracking

**Key Methods:**
- `log({userId, tenantId, role, action, targetResource, ...})` - Log audit event
- `query({tenantId, userId, action, targetResource, ...})` - Query with filters
- `getUserActivity(userId, tenantId, limit)` - Get user's recent actions
- `getActivitySummary(tenantId, days)` - Daily action aggregation
- `getSuspiciousActivity(tenantId)` - Detect suspicious patterns
- `exportLogs(tenantId, format, filters)` - Export as JSON or CSV

**Logged Actions:**
- USER_CREATED, LOGIN_ATTEMPT, LOGIN_SUCCESS, LOGOUT
- SESSION_CREATED, SESSION_PROCESSED, SESSION_VIEWED, SESSION_FINALISED
- CONSULTATION_CREATED, CONSULTATION_UPDATED, CONSULTATION_CANCELLED
- ALERT_CREATED, ALERT_ACKNOWLEDGED, ALERT_ESCALATED, ALERT_RESOLVED
- EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_OFFBOARDED
- TENANT_CREATED, TENANT_SUSPENDED, TENANT_ACTIVATED, TENANT_DELETED

**Features:**
- Complete action tracking
- Change snapshots (before/after)
- IP address + user agent logging
- Request ID linking
- Suspicious activity detection (failed logins, unauthorized access)
- CSV/JSON export
- Non-blocking (failures don't stop application)

## Routes Implementation

### 1. Auth Routes (`auth.routes.js`)

**POST /auth/register**
- Role-based user creation (CITTAA_SUPER_ADMIN → COMPANY_ADMIN; COMPANY_ADMIN → HR_ADMIN/CLINICIAN)
- Password complexity validation (10+ chars, upper/lower/number/special)
- Welcome email with temporary password
- Audit logging

**POST /auth/login**
- Email + password authentication
- Login attempt tracking (5 attempts → 15-minute lockout)
- Optional TOTP MFA for CITTAA_SUPER_ADMIN
- Refresh token rotation
- Audit logging

**POST /auth/refresh**
- Issue new access token
- Rotate refresh token
- HttpOnly cookie-based refresh tokens

**POST /auth/logout**
- Token blacklisting in Redis
- Cookie clearing
- Audit logging

**POST /auth/forgot-password**
- Generate 15-minute reset token
- Send reset email

**POST /auth/reset-password**
- Validate reset token
- Update password with complexity check

**POST /auth/mfa/setup**
- Generate TOTP secret
- Return QR code (otplib + qrcode)

**POST /auth/mfa/verify**
- Verify TOTP code
- Enable MFA on account

**GET /auth/google**
- Generate Google OAuth URL

**GET /auth/google/callback**
- Handle OAuth callback
- Store Google tokens (access + refresh)

### 2. Consultations Routes (`consultations.routes.js`)

**GET /consultations**
- List consultations (role-scoped)
- Filter by status, employee ID
- Pagination support

**POST /consultations**
- Create consultation
- Auto-generate Google Calendar event with Meet link
- Send invitations to employee + clinician
- Support for online (with Meet) and in-person modes
- Customizable duration, location, notes

**GET /consultations/:id**
- Fetch single consultation with populated relationships
- Role-based authorization

**PUT /consultations/:id**
- Reschedule consultation
- Update Google Calendar event if applicable
- Update notes and status

**DELETE /consultations/:id**
- Cancel consultation
- Auto-cancel Google Calendar event
- Record cancellation reason

**POST /consultations/:id/complete**
- Mark consultation complete
- Store clinician notes
- Update linked session with notes

**GET /consultations/availability/:clinicianId**
- Get available time slots for clinician
- Query params: date (YYYY-MM-DD), duration (minutes)
- Returns free slots computed from Google Calendar free/busy API
- Working hours: 9am-6pm IST, 30-minute increments

### 3. Sessions Routes (`sessions.routes.js`)

**POST /sessions**
- Create assessment session from audio upload
- Validate audio MIME type and file size
- Check tenant monthly quota
- Queue assessment job in Bull queue
- Return session ID for polling

**Assessment Job Processor:**
1. Extract acoustic features via VocaCore service
2. Analyze with VocaCore™ engine (Gemini 1.5 Pro)
3. Generate employee wellness output (anonymized)
4. Evaluate alerts via alertEngine
5. Send alert notifications to HR admins
6. Mark session completed

**GET /sessions**
- List sessions (role-scoped)
- Employees see only their own
- HR/Clinician see tenant-wide data

**GET /sessions/:id**
- Fetch session with full results
- Role-based data visibility:
  - EMPLOYEE: only employeeWellnessOutput (anonymized scores)
  - Clinical roles: full vocacoreResults + clinical data

**PUT /sessions/:id/finalise**
- Clinician finalizes session
- Generate PDF report
- Store clinician notes in linked session

**GET /sessions/:id/report**
- Download PDF report
- Authorization checks
- Calls pdfGenerator service

**DELETE /sessions/:id**
- CITTAA_SUPER_ADMIN only soft delete
- Record deletion reason

### 4. Employees Routes (`employees.routes.js`)

**GET /employees**
- List employees (HR/Admin only)
- Search by name/email
- Filter by active status
- Pagination

**POST /employees**
- Add single employee
- Generate temporary password
- Send welcome email

**GET /employees/:id**
- Fetch employee profile
- Return assessment statistics

**PUT /employees/:id**
- Update employee details
- Validate email uniqueness

**DELETE /employees/:id**
- Offboard employee (soft delete)
- Record offboarding reason

**GET /employees/:id/sessions**
- Get employee's assessment history
- Paginated with sorting

**POST /employees/bulk-import**
- Accept CSV file
- Queue bulk import job
- Return batch ID for polling

**Bulk Import Job Processor:**
- Parse CSV with headers: email, firstName, lastName, department
- Create users with temporary passwords
- Handle duplicates and validation errors
- Return import statistics

**GET /employees/import/:batchId**
- Check bulk import progress
- Return job state and results

**POST /employees/:id/invite**
- Send assessment invitation email
- Optional scheduled date

**POST /employees/:id/schedule**
- Set assessment schedule
- Frequency: weekly/monthly/quarterly
- Next assessment date

### 5. Alerts Routes (`alerts.routes.js`)

**GET /alerts**
- List alerts (paginated)
- Filter by status, alert level
- Employees see only their own alerts

**GET /alerts/:id**
- Fetch alert detail with populated relationships
- Authorization checks

**PUT /alerts/:id/acknowledge**
- Acknowledge alert
- Store acknowledgement note
- Change status to "acknowledged"

**PUT /alerts/:id/escalate**
- Escalate alert to HR/clinician
- Send escalation notification email
- Change status to "escalated"

**PUT /alerts/:id/resolve**
- Resolve alert
- Store resolution summary
- Change status to "resolved"

**GET /alerts/stats**
- Dashboard alert statistics
- Counts by status and level

### 6. Analytics Routes (`analytics.routes.js`)

**GET /analytics/overview**
- Dashboard KPIs
- Total sessions, completion rate
- Active/critical alerts
- Average wellness score

**GET /analytics/trends**
- Historical trend data
- Period filter: week/month/quarter
- Daily aggregation with counts and averages

**GET /analytics/departments**
- Department-wise breakdown
- Assessment counts, average scores, stress levels

**GET /analytics/platform**
- CITTAA_SUPER_ADMIN: platform-wide statistics
- Tenant counts, user counts, top tenants

**GET /analytics/export**
- Export analytics to CSV
- Columns: Date, Employee, Email, Department, Score, Stress, Status

### 7. Tenants Routes (`tenants.routes.js`)

**GET /tenants**
- CITTAA_SUPER_ADMIN: list all tenants
- Filter by status (active/suspended/deleted)
- Pagination

**POST /tenants**
- Create new tenant
- Create COMPANY_ADMIN user
- Send admin welcome email
- Return tenant + admin details

**GET /tenants/:id**
- Fetch tenant details
- Return admin/employee counts

**PUT /tenants/:id**
- Update tenant configuration
- Modify assessment quota
- Update Google configuration
- Change status

**POST /tenants/:id/suspend**
- Suspend tenant (prevents operations)
- Record suspension reason

**POST /tenants/:id/activate**
- Reactivate suspended tenant

**DELETE /tenants/:id**
- Soft delete tenant
- Record deletion reason

**POST /tenants/:id/impersonate**
- Generate impersonation JWT for admin
- 1-hour expiry
- Audit logged with impersonator ID

## Express App (app.js)

**Middleware Chain:**
1. Helmet (security headers)
2. CORS (whitelist-based)
3. Request ID injection
4. Body parser (10MB limit)
5. Morgan logging
6. Route handlers
7. 404 handler
8. Global error handler

**Features:**
- Swagger UI at `/docs`
- Bull Board at `/admin/queues` (admin-only with optional password)
- Health check endpoints (`/health`, `/health/detailed`)
- Comprehensive error handling
  - JWT validation errors
  - File upload errors
  - Multer errors
  - Unhandled exceptions

**Security:**
- Content Security Policy headers
- CORS whitelist validation
- Request validation
- Role-based access control
- Token blacklisting

## Server (server.js)

**Initialization:**
1. Load environment variables
2. Connect to MongoDB with error handling
3. Verify Redis connection
4. Start HTTP server on configured PORT
5. Register graceful shutdown handlers

**Graceful Shutdown (SIGTERM/SIGINT):**
1. Stop accepting new connections
2. Wait for in-flight requests (30-second timeout)
3. Disconnect MongoDB
4. Close Redis connection
5. Exit process

**Error Handlers:**
- EADDRINUSE detection
- Unhandled promise rejections
- Uncaught exceptions
- Comprehensive logging

## Key Implementation Details

### Authentication Flow
1. User logs in with email + password
2. System checks login attempts (max 5, then 15-min lockout)
3. If MFA enabled: send TOTP challenge
4. Generate access token (15-min) + refresh token (7-day)
5. Refresh token stored as httpOnly, secure cookie
6. Access token in response body for frontend storage

### Assessment Processing
1. User uploads audio file (multipart/form-data)
2. Multer stores in memory (validated MIME type, size < 50MB)
3. Session created in database
4. Audio + session ID queued to Bull queue
5. API returns session ID for polling
6. Job processor:
   - Extracts features via VocaCore service
   - Analyzes with Gemini 1.5 Pro
   - Generates wellness output (employee-visible)
   - Evaluates clinical scores
   - Creates alerts if thresholds breached
   - Notifies HR admins via email
7. Session marked complete, available for clinician review

### Alert Lifecycle
1. Session analysis completes
2. Alert engine evaluates against thresholds
3. If triggered: creates Alert document, sends notifications
4. HR admin acknowledges alert (manual workflow)
5. Can escalate to specialist
6. Resolved with summary notes
7. All state changes audit logged

### Consultation Booking
1. HR creates consultation (employee + clinician)
2. If online + Google connected:
   - Calls Google Calendar API
   - Creates event with Google Meet link
   - Stores meet link in consultation document
3. Sends invitations to both parties (email + calendar invite)
4. Can reschedule: updates Google event automatically
5. Can cancel: deletes Google event, sends cancellation notices

### Report Generation
1. Clinician completes consultation
2. Calls session finalize endpoint
3. PDF generated with:
   - Cittaa branding header
   - Patient info (anonymizable)
   - VocaCore scores with gauge visuals
   - Biomarker findings + severity
   - Clinical flags + recommendations
   - Footer with disclaimers
4. PDF buffered in memory, streamed to client

## Error Handling Strategy

**Service-Layer Errors:**
- Feature extraction failures: log + return error
- Gemini analysis failures: fallback to deterministic scoring
- Google Calendar failures: continue without calendar event
- Email failures: log but don't fail operation
- Alert evaluation: never fail (continue processing)
- PDF generation: graceful degradation

**API-Layer Errors:**
- Input validation: 400 Bad Request
- Authentication: 401 Unauthorized
- Authorization: 403 Forbidden
- Not found: 404
- Conflict: 409 (duplicate email, etc.)
- Rate limit: 429 (quota exceeded)
- Server errors: 500 with minimal details in production

**Audit Logging:**
- All failures logged with outcome: 'failure'
- Error message included (never sensitive data)
- Request ID for tracing

## Security Measures

1. **Authentication:**
   - Password hashing (bcrypt, 10 rounds)
   - JWT tokens (HS256)
   - Refresh token rotation
   - MFA via TOTP (optional for super admin)

2. **Authorization:**
   - Role-based access control (RBAC)
   - Tenant isolation (all queries filtered by tenantId)
   - Request authorization checks

3. **Data Protection:**
   - CORS whitelist validation
   - Helmet security headers
   - No sensitive data in logs
   - PII anonymization options

4. **API Security:**
   - Rate limiting (implement via middleware if needed)
   - Input validation + sanitization
   - File upload validation (MIME type, size)
   - SQL injection prevention (Mongoose ORM)

5. **Infrastructure:**
   - Environment-based secrets
   - HTTPS recommended (reverse proxy)
   - Graceful shutdown for zero-downtime deployment

## Environment Variables Required

```
# Server
PORT=3001
NODE_ENV=production
API_URL=https://api.vocalysis.com

# Database
MONGODB_URI=mongodb://localhost:27017/vocalysis

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=<strong-secret-key>
JWT_REFRESH_SECRET=<different-strong-secret>

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@cittaa.com
SMTP_PASS=<password>
SMTP_FROM_EMAIL=noreply@cittaa.com

# Google OAuth
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=https://api.vocalysis.com/auth/google/callback

# VocaCore
VOCOCORE_SERVICE_URL=http://localhost:5000
VOCOCORE_INTERNAL_KEY=<api-key>
VOCOCORE_INFERENCE_KEY=<gemini-api-key>

# CORS
CORS_ORIGINS=https://vocalysis.com,https://app.vocalysis.com

# Bull Board (optional)
BULL_BOARD_PASSWORD=<optional-password>

# Platform
PLATFORM_URL=https://vocalysis.com
```

## Performance Optimizations

1. **Database:**
   - Lean queries where appropriate
   - Pagination for list endpoints
   - Indexed fields (email, tenantId, employeeId)

2. **Caching:**
   - Redis for session tokens, login attempts
   - Bull queues for background processing
   - Job retry with exponential backoff

3. **Memory:**
   - Multer memory storage (not disk)
   - Streaming PDF generation
   - Buffer cleanup after processing

4. **Processing:**
   - Async/await throughout
   - Batch operations where possible
   - Non-blocking email delivery

## Testing Recommendations

1. **Unit Tests:**
   - Service layer methods
   - Authentication logic
   - Alert threshold evaluation

2. **Integration Tests:**
   - API endpoint flows
   - Database interactions
   - Queue processing

3. **E2E Tests:**
   - Complete assessment flow
   - Consultation booking
   - Alert notifications

## Deployment Checklist

- [ ] Environment variables configured
- [ ] MongoDB and Redis running
- [ ] VocaCore service deployed
- [ ] Google OAuth configured
- [ ] SMTP credentials valid
- [ ] CORS origins whitelist set
- [ ] SSL certificates installed
- [ ] Reverse proxy configured
- [ ] Log aggregation setup
- [ ] Monitoring/alerting enabled
- [ ] Backup strategy in place

## Support & Maintenance

- All code is production-ready with no TODOs or placeholders
- Comprehensive error handling and logging throughout
- Security best practices implemented
- Scalable architecture with background job processing
- Full audit trail for compliance
- Non-blocking operations for availability
