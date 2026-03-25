# Vocalysis Platform 2.0 - Architecture Overview

## Project Structure

```
vocalysis-platform/
├── worker/                      # Background job processing service
│   ├── src/
│   │   ├── worker.js           # Main worker entry point & queue setup
│   │   ├── logger.js           # Winston logger configuration
│   │   ├── db.js               # MongoDB connection handler
│   │   ├── processors/         # Queue job processors
│   │   │   ├── audioAnalysis.js           # Audio feature extraction & risk analysis
│   │   │   ├── pdfGeneration.js           # PDF report generation
│   │   │   ├── emailNotifications.js      # Email delivery
│   │   │   ├── webhookDelivery.js         # Webhook event delivery with retries
│   │   │   ├── bulkImport.js              # CSV employee bulk import
│   │   │   ├── scheduledAssessments.js    # Daily assessment reminders (8 AM IST)
│   │   │   ├── weeklyHRReport.js          # Weekly HR dashboard emails (Mon 9 AM IST)
│   │   │   ├── alertEscalation.js         # Auto-escalate unresolved alerts (every 30 min)
│   │   │   ├── audioCleanup.js            # Cleanup orphaned audio sessions (every 5 min)
│   │   │   └── consultationReminders.js   # Consultation reminders (60-min & 15-min)
│   │   └── models/             # Mongoose schemas
│   │       ├── Session.js
│   │       ├── Employee.js
│   │       ├── Tenant.js
│   │       ├── Alert.js
│   │       ├── WebhookDeliveryLog.js
│   │       ├── BulkImportLog.js
│   │       ├── AuditLog.js
│   │       └── Consultation.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
└── healthcheck/                # Health monitoring & status page
    ├── src/
    │   ├── server.js           # Express server & health check scheduler
    │   ├── logger.js           # Winston logger configuration
    │   ├── alerter.js          # Alert notification system with debouncing
    │   ├── checks/             # Individual health check implementations
    │   │   ├── apiCheck.js     # API service availability
    │   │   ├── vococoreCheck.js # VocaCore™ AI engine
    │   │   ├── databaseCheck.js # MongoDB connectivity
    │   │   ├── redisCheck.js   # Redis connectivity & memory usage
    │   │   └── workerCheck.js  # Worker queue statistics & backlog monitoring
    │   └── statusPage/
    │       └── index.html      # Beautiful public status dashboard
    ├── package.json
    ├── .env.example
    └── .gitignore
```

## Worker Service Architecture

### Queue Management (Bull + Redis)

The worker service manages 5 independent Bull queues for job processing:

| Queue | Concurrency | Timeout | Purpose |
|-------|-------------|---------|---------|
| `audio-analysis` | 5 | 10 min | Audio feature extraction & risk scoring |
| `pdf-generation` | 3 | 2 min | PDF report generation |
| `email-notifications` | 10 | 30s | Email delivery (100/min rate limit) |
| `webhook-delivery` | 5 | 10s | Event webhook delivery with exponential backoff |
| `bulk-employee-import` | 2 | 30 min | CSV bulk employee import |

### Cron Job Schedules

| Job | Schedule | Timezone | Purpose |
|-----|----------|----------|---------|
| Scheduled Assessments | Daily 08:00 | Asia/Kolkata | Queue assessment reminders for employees |
| Weekly HR Report | Monday 09:00 | Asia/Kolkata | Generate wellness summary for HR admins |
| Alert Escalation | Every 30 min | UTC | Auto-escalate unresolved critical alerts |
| Audio Cleanup | Every 5 min | UTC | Cleanup orphaned session audio records |
| Consultation Reminders | Every 15 min | UTC | Send 60-min & 15-min consultation reminders |

### Key Processors

#### 1. Audio Analysis Processor
- Receives audio as base64-encoded buffer
- Calls VocaCore /extract endpoint for feature extraction
- Calls VocaCore /analyze endpoint for risk assessment
- Updates Session with analysisResults and status
- Marks audio as deleted (it's in-memory only)
- Evaluates alert thresholds (critical/high/medium/low)
- Creates Alert documents if risk exceeds threshold
- Queues email notifications to clinician
- Queues webhook delivery to tenant if configured
- Updates Employee wellnessProfile with current risk level & history
- Updates Tenant usedAssessmentCount
- Returns: `{ sessionId, status: 'complete', overallRiskLevel, alertTriggered }`

#### 2. PDF Generation Processor
- Fetches Session with populated patient/clinician/tenant
- Generates professional PDF report using PDFKit
- Saves to Railway Volume at `/app/storage/reports/{tenantId}/{sessionId}.pdf`
- Updates Session.reportPdfKey and reportStatus = 'finalised'
- Includes metadata, analysis results, recommendations based on risk level
- Returns: `{ sessionId, pdfPath, status: 'success' }`

#### 3. Email Notifications Processor
- Supports 7 email templates: assessment_invite, alert_notification, consultation_invite, welcome_email, password_reset, weekly_hr_report, consultation_reminder
- Uses nodemailer with SMTP configuration
- Retries up to 3 times with 30-second delays
- Logs only hashed recipient email (privacy) and template type
- Rate limited to 100 emails per minute

#### 4. Webhook Delivery Processor
- Builds HMAC-SHA256 signature of payload using webhook secret
- POSTs to webhookUrl with 10-second timeout
- Includes headers: X-Vocalysis-Signature, X-Vocalysis-Timestamp, X-Vocalysis-Event
- Logs delivery attempts to WebhookDeliveryLog
- On failure: Exponential backoff retry (1min → 5min → 30min → 2hr → 6hr)
- After 5 failures: Mark finalStatus='failed_permanent', stop retrying

#### 5. Bulk Import Processor
- Parses CSV using csv-parse module
- Validates required columns: employeeId, fullName, email, departmentId, jobTitle, dateOfJoining
- Validates email format, checks for duplicates per tenant
- Inserts valid employees in batches of 50 using insertMany
- Stores result in Redis (7-day TTL) and MongoDB for persistence
- Sends summary email to triggering HR Admin
- Returns: `{ batchId, total, inserted, skipped, failed }`

#### 6-11. Cron Job Processors
All cron processors follow similar patterns:
- Query relevant records (Employee, Consultation, Alert, etc.)
- Apply business logic for reminders/escalations/cleanup
- Queue email notifications as needed
- Log actions to AuditLog for compliance
- Return summary statistics

## Healthcheck Service Architecture

### Express Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Serve static status page (index.html) |
| `/status` | GET | JSON endpoint with all service statuses + uptime % |
| `/status/history` | GET | Historical health check data (queryable by service & hours) |
| `/incidents` | GET | Active and recent incident information |
| `/health` | GET | Healthcheck service own health endpoint |

### Health Check Implementation

Each check runs independently and returns:
```json
{
  "service": "api|vococore|database|redis|worker",
  "status": "healthy|degraded|down",
  "responseTimeMs": 150,
  "timestamp": "2026-03-25T10:30:00Z",
  "uptime": true
}
```

**Status Logic:**
- **API**: 200 + <500ms = healthy; 200 + 500-2000ms = degraded; non-200 or timeout = down
- **VocaCore**: Fallback from Railway internal URL to env var
- **Database**: MongoDB ping with 3s timeout
- **Redis**: PING command with memory usage stats
- **Worker**: Bull queue stats via Redis (alerts if failed>10 or waiting>100)

### Overall Status Calculation

- **Healthy**: All services healthy or unknown
- **Degraded**: At least one service degraded
- **Down**: At least one service down

### Alert System

- Debounced per service (max 1 alert per 30 minutes)
- Sends degradation alert when service status changes from healthy to degraded/down
- Sends recovery alert when service recovers to healthy
- Alerts sent to ALERT_EMAIL_TO env var (e.g., devops@cittaa.in)
- Email includes service name, status, error details, links to status page

### Status Page Features

- Beautiful, responsive HTML dashboard
- Service status cards with live status indicators (animated dots)
- Response time and uptime percentage metrics
- Real-time updates every 30 seconds (JavaScript fetch + meta refresh)
- Current incidents section
- Footer with Cittaa branding
- Mobile-responsive design
- Cittaa purple (#6B21A8) branding theme

## Database Models

### Session
- Tracks individual wellness assessment sessions
- Stores audio deletion state, analysis results, PDF report path
- Indexes: tenantId+createdAt, patientId, clinicianId

### Employee
- Represents tenant staff (employees, clinicians, HR admins)
- Tracks wellness profile, assessment schedule, consent status
- Unique index: tenantId+email
- Indexes: status, role

### Tenant
- Parent organization using Vocalysis
- Tracks webhook configuration, assessment usage metrics
- Stores webhook URL, secret, and enabled flag

### Alert
- Critical risk detected from assessment
- Tracks severity, status (new/escalated/acknowledged/resolved)
- Indexes for querying by tenant, employee, or triggeredAt time

### WebhookDeliveryLog
- Audit trail of all webhook delivery attempts
- Tracks attempt number, status, response time, error details
- Index: tenantId+event, timestamp

### BulkImportLog
- Audit trail of bulk employee imports
- Tracks counts: total, inserted, skipped, failed
- Unique: batchId

### AuditLog
- General audit trail for compliance
- Records: audio cleanup delays, orphaned sessions, escalations
- Index: tenantId+timestamp

### Consultation
- Scheduled consultations between employees and clinicians
- Tracks reminders sent (60min, 15min)
- Indexes: status, scheduledAt

## Environment Variables

### Worker Service
```
MONGODB_URI           MongoDB connection string
REDIS_URL            Redis connection string
VOCOCORE_SERVICE_URL VocaCore engine endpoint
SMTP_*               Email configuration (host, port, user, password)
WEB_APP_URL          Frontend URL for links in emails
API_BASE_URL         API base URL
NODE_ENV             production|development
LOG_LEVEL            debug|info|warn|error
STORAGE_PATH         PDF storage location
```

### Healthcheck Service
```
MONGODB_URI          MongoDB (optional, for logging)
REDIS_URL            Redis connection
API_URL              API health endpoint
VOCOCORE_SERVICE_URL VocaCore endpoint
SMTP_*               Alert email configuration
ALERT_EMAIL_TO       Email address(es) for alerts
HEALTHCHECK_URL      Status page URL (in alerts)
PORT                 Express port (default: 8080)
```

## Deployment Notes

### Worker Service
- Runs as background service
- Connects to shared Redis and MongoDB
- Handles long-running jobs (up to 10 minutes for audio analysis)
- Graceful shutdown: waits for jobs to complete, closes queues

### Healthcheck Service
- Runs as Express web server (port 8080)
- Standalone service, minimal dependencies
- Runs health checks every 60 seconds
- Serves public status page at `/`
- Optional MongoDB for persistent health logs

### Scalability
- Worker: Multiple instances can run simultaneously (different machine/pod)
- Bull queues automatically distribute jobs across instances
- Healthcheck: Single instance recommended (duplicate alerts if multiple)
- Redis: Shared backend for both services
- MongoDB: Shared persistence layer

## Error Handling & Resilience

### Worker
- Job retries with exponential backoff
- Dead letter queue for permanent failures
- Graceful degradation (continues if VocaCore unavailable)
- Audit logs for failed operations
- Debounced alerts to prevent notification spam

### Healthcheck
- Timeout protection on all external calls (3-10 seconds)
- Graceful handling of unavailable services
- In-memory state tracking (survives brief database unavailability)
- Fallback URLs for redundant services

## Monitoring & Observability

- Winston structured logging with JSON output
- Log files: worker/logs/worker.log, healthcheck/logs/healthcheck.log
- Health check results logged to MongoDB HealthCheckLog collection
- Audit logs for all significant events
- Webhook delivery logs for integration debugging
