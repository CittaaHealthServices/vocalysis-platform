# Vocalysis Platform 2.0 — Complete Project Structure

**Last Updated:** March 2026
**Version:** 2.0.0
**Status:** Production-Ready

---

## Directory Tree

```
vocalysis-platform/
├── README.md                           Main platform documentation
├── PHASE_2_SPEC.md                     Phase 2 features specification
├── PROJECT_STRUCTURE.md                This file
├── .gitignore                          Git ignore rules (never commit .env, node_modules, etc)
│
├── api/                                ============ NODEJS REST API ============
│   ├── package.json                    Dependencies and scripts
│   ├── .env.example                    Environment variables template
│   ├── railway.toml                    Railway deployment config
│   │
│   ├── src/
│   │   ├── server.js                   Express app entry point with middleware setup
│   │   ├── db.js                       MongoDB connection factory
│   │   ├── redis.js                    Redis client initialization
│   │   ├── logger.js                   Winston logging configuration
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js                 JWT verification (access + refresh tokens)
│   │   │   ├── errorHandler.js         Global error catching and response formatting
│   │   │   ├── requestLogger.js        HTTP request/response logging
│   │   │   ├── rateLimiter.js          Rate limiting per IP (100 req/min)
│   │   │   └── corsHandler.js          CORS configuration with origin validation
│   │   │
│   │   ├── routes/
│   │   │   ├── index.js                Route aggregator and mounting
│   │   │   ├── auth.js                 /auth/* — login, logout, refresh, signup
│   │   │   ├── users.js                /users/* — profile, password change
│   │   │   ├── employees.js            /employees/* — employee CRUD (HR admin)
│   │   │   ├── sessions.js             /sessions/* — voice assessment submissions
│   │   │   ├── consultations.js        /consultations/* — book/manage consultations
│   │   │   ├── calendar.js             /calendar/* — Google Calendar sync (OAuth)
│   │   │   ├── alerts.js               /alerts/* — risk alerts for clinicians
│   │   │   ├── tenants.js              /tenants/* — tenant management (super admin)
│   │   │   ├── apikeys.js              /apikeys/* — API key management
│   │   │   ├── health.js               /health — service health check
│   │   │   ├── admin/
│   │   │   │   ├── bullBoard.js        /admin/queues — Bull job queue dashboard
│   │   │   │   ├── auditLogs.js        /admin/audit-logs — audit trail viewer
│   │   │   │   └── analytics.js        /admin/analytics — platform metrics
│   │   │   └── whatsapp.js             /whatsapp/* — WhatsApp bot webhook + sending (Phase 2)
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js       Login/signup/token refresh logic
│   │   │   ├── userController.js       User profile management
│   │   │   ├── employeeController.js   Employee CRUD operations
│   │   │   ├── sessionController.js    Voice assessment processing
│   │   │   ├── consultationController.js Consultation booking
│   │   │   ├── calendarController.js   Google Calendar integration
│   │   │   ├── alertController.js      Alert generation + management
│   │   │   ├── tenantController.js     Tenant onboarding + settings
│   │   │   ├── apiKeyController.js     API key CRUD
│   │   │   ├── whatsappController.js   WhatsApp webhook handler (Phase 2)
│   │   │   └── managerController.js    Manager dashboard APIs (Phase 2)
│   │   │
│   │   ├── services/
│   │   │   ├── authService.js          JWT generation, password hashing (bcrypt)
│   │   │   ├── encryptionService.js    Field-level encryption for PII
│   │   │   ├── vococoreService.js      VocaCore™ API client + result processing
│   │   │   ├── calendarService.js      Google Calendar API client
│   │   │   ├── storageService.js       Audio file upload/download/cleanup
│   │   │   ├── emailService.js         SMTP email sending + templates
│   │   │   ├── notificationService.js  In-app notification creation
│   │   │   ├── alertingService.js      Alert rule evaluation + escalation
│   │   │   ├── auditService.js         Audit log creation + querying
│   │   │   ├── webhookService.js       Outgoing webhook delivery
│   │   │   ├── bulkImportService.js    CSV employee import
│   │   │   ├── metricsService.js       Platform metrics aggregation
│   │   │   ├── whatsappService.js      WhatsApp message sending (Phase 2)
│   │   │   └── managerService.js       Manager nudge + dashboard logic (Phase 2)
│   │   │
│   │   ├── models/                     Mongoose schemas + business logic
│   │   │   ├── User.js                 Users (auth, roles, multi-tenant)
│   │   │   ├── Tenant.js               Tenant metadata + settings
│   │   │   ├── Employee.js             Employee profiles + wellness data
│   │   │   ├── Session.js              Voice assessment sessions
│   │   │   ├── Alert.js                Risk alerts for clinicians
│   │   │   ├── Consultation.js         Consultation bookings + outcomes
│   │   │   ├── AuditLog.js             User action audit trail
│   │   │   ├── ApiKey.js               API key storage (hashed)
│   │   │   ├── HealthCheckLog.js       Service health history
│   │   │   ├── CalendarSync.js         Google Calendar event cache
│   │   │   ├── Notification.js         In-app notification storage
│   │   │   ├── ManagerNudge.js         Manager dashboard nudges (Phase 2)
│   │   │   ├── WhatsAppDeliveryLog.js  WhatsApp message delivery tracking (Phase 2)
│   │   │   └── index.js                Model aggregator + exports
│   │   │
│   │   ├── utils/
│   │   │   ├── constants.js            Role names, status enums, magic numbers
│   │   │   ├── validators.js           Input validation (email, phone, etc)
│   │   │   ├── helpers.js              Helper functions (formatting, etc)
│   │   │   ├── security.js             JWT signing, hashing, encryption
│   │   │   └── pagination.js           Cursor-based pagination for large datasets
│   │   │
│   │   └── config/
│   │       ├── database.js             MongoDB connection pooling
│   │       ├── redis.js                Redis connection + options
│   │       ├── logger.js               Winston logger levels + formats
│   │       ├── passport.js             Passport.js strategies (Google OAuth)
│   │       └── env.js                  Environment variable validation
│   │
│   └── tests/                          Jest test suites (not shown in detail)
│
├── vococore/                           ============ PYTHON ML ENGINE ============
│   ├── requirements.txt                Python dependencies
│   ├── .env.example                    Environment variables template
│   ├── railway.toml                    Railway deployment config
│   │
│   ├── app.py                          Flask app entry point + routes
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── feature_extractor.py        Audio loading + preprocessing
│   │   ├── inference.py                Model loading + inference logic
│   │   ├── postprocessor.py            Result aggregation + normalization
│   │   └── validator.py                Output validation against schema
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py                   Flask routes (/extract, /health)
│   │   ├── schemas.py                  Request/response validation (Marshmallow)
│   │   └── errors.py                   Custom error responses
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── audio.py                    Audio processing utilities
│   │   ├── logging.py                  Structured logging configuration
│   │   └── security.js                 Request signing verification
│   │
│   ├── training/                       (Optional) Model training pipelines
│   │   ├── requirements.txt            ML libraries (torch, librosa, wandb)
│   │   ├── train_sota.py               WavLM-based SOTA model training
│   │   ├── evaluate.py                 Model evaluation on test set
│   │   ├── datasets/
│   │   │   ├── downloader.py           Download & preprocess datasets
│   │   │   ├── kaggle_config.json      (user must provide)
│   │   │   └── README.md               Dataset sources + instructions
│   │   ├── models/
│   │   │   ├── wavlm_baseline.py       WavLM backbone architecture
│   │   │   ├── custom_head.py          Classification head
│   │   │   └── convert_to_onnx.py      Export to ONNX format
│   │   └── results/
│   │       └── (training artifacts)
│   │
│   └── models/
│       ├── (SOTA model files .pth/.onnx — stored in cloud or Git LFS)
│       └── README.md                   Model versioning + download instructions
│
├── worker/                             ============ NODEJS ASYNC WORKER ============
│   ├── package.json                    Dependencies and scripts
│   ├── .env.example                    Environment variables template
│   ├── railway.toml                    Railway deployment config
│   │
│   ├── src/
│   │   ├── worker.js                   Bull queue initialization + processor setup
│   │   ├── db.js                       MongoDB connection
│   │   ├── redis.js                    Redis client
│   │   ├── logger.js                   Winston logging
│   │   │
│   │   ├── queues/
│   │   │   ├── index.js                Queue factory + aggregator
│   │   │   ├── audioAnalysisQueue.js   Voice assessment processing queue
│   │   │   ├── emailQueue.js           Email sending queue
│   │   │   ├── webhookQueue.js         Outgoing webhook delivery queue
│   │   │   ├── schedulingQueue.js      Consultation + assessment scheduling
│   │   │   └── whatsappQueue.js        WhatsApp message sending (Phase 2)
│   │   │
│   │   ├── processors/
│   │   │   ├── audioAnalysis.js        Coordinate VocaCore calls + result storage
│   │   │   ├── emailNotifications.js   Format + send email templates
│   │   │   ├── webhookDelivery.js      Retry webhooks with exponential backoff
│   │   │   ├── consultationReminders.js Send reminders 24h + 15m before
│   │   │   ├── scheduledAssessments.js Send assessment invitations
│   │   │   ├── bulkImport.js           CSV parsing + employee creation
│   │   │   ├── pdfGeneration.js        Generate wellness reports (PDFKit)
│   │   │   ├── audioCleanup.js         Delete audio files after processing
│   │   │   ├── alertEscalation.js      Escalate critical alerts
│   │   │   ├── weeklyHRReport.js       Aggregate weekly HR summary
│   │   │   └── whatsappMessages.js     Send + retry WhatsApp messages (Phase 2)
│   │   │
│   │   ├── models/                     Mongoose schemas
│   │   │   ├── Session.js              Voice sessions
│   │   │   ├── Alert.js                Risk alerts
│   │   │   ├── Consultation.js         Consultation bookings
│   │   │   ├── AuditLog.js             Action audit trail
│   │   │   ├── BulkImportLog.js        CSV import history + results
│   │   │   ├── ManagerNudge.js         Manager nudges (Phase 2)
│   │   │   └── index.js                Model exports
│   │   │
│   │   └── services/
│   │       ├── vococoreService.js      VocaCore API client
│   │       ├── emailService.js         SMTP email sending
│   │       ├── storageService.js       Audio file operations
│   │       ├── alertingService.js      Alert rule evaluation
│   │       ├── auditService.js         Audit log creation
│   │       └── whatsappService.js      WhatsApp API calls (Phase 2)
│   │
│   └── tests/                          Jest test suites
│
├── healthcheck/                        ============ NODEJS STATUS MONITOR ============
│   ├── package.json                    Dependencies
│   ├── .env.example                    Environment variables template
│   ├── railway.toml                    Railway deployment config
│   │
│   ├── src/
│   │   ├── server.js                   Express app + status page server
│   │   ├── logger.js                   Winston logging
│   │   │
│   │   ├── checks/
│   │   │   ├── index.js                Health check orchestrator
│   │   │   ├── mongodbCheck.js         MongoDB connectivity test
│   │   │   ├── redisCheck.js           Redis connectivity test
│   │   │   ├── apiCheck.js             API /health endpoint polling
│   │   │   ├── vococoreCheck.js        VocaCore /health endpoint polling
│   │   │   └── workerCheck.js          Worker job queue health
│   │   │
│   │   ├── alerts/
│   │   │   ├── index.js                Alert manager + debouncer
│   │   │   ├── emailAlerter.js         Send alert emails to ALERT_EMAIL_TO
│   │   │   ├── slackAlerter.js         (Optional) Send to Slack
│   │   │   └── statusUpdater.js        Update status page database
│   │   │
│   │   ├── routes/
│   │   │   ├── index.js                Route aggregator
│   │   │   ├── healthStatus.js         GET /health + GET /health/json
│   │   │   ├── statusPage.js           GET / (HTML status page)
│   │   │   └── metrics.js              GET /metrics (Prometheus-style)
│   │   │
│   │   └── utils/
│   │       ├── logger.js               Structured logging
│   │       └── constants.js            Check intervals, alert thresholds
│   │
│   └── public/                         Static assets for status page
│       ├── index.html                  Status page HTML (no build needed)
│       ├── styles.css                  Responsive Tailwind styling
│       └── script.js                   Real-time updates via polling
│
├── web/                                ============ REACT + VITE FRONTEND ============
│   ├── package.json                    Dependencies and scripts
│   ├── .env.example                    Environment variables template
│   ├── railway.toml                    Railway deployment config
│   ├── vite.config.js                  Vite bundler configuration
│   ├── tailwind.config.js              Tailwind CSS configuration
│   ├── index.html                      HTML entry point
│   │
│   ├── src/
│   │   ├── main.jsx                    React app entry point
│   │   ├── App.jsx                     Root component + routing
│   │   │
│   │   ├── pages/                      Page components (route-matched)
│   │   │   ├── LoginPage.jsx           /login — email/password form
│   │   │   ├── DashboardPage.jsx       / — main dashboard
│   │   │   ├── EmployeePage.jsx        /employees — HR employee management
│   │   │   ├── SessionPage.jsx         /sessions — assessment recording
│   │   │   ├── ResultsPage.jsx         /sessions/:id/results — results view
│   │   │   ├── ConsultationsPage.jsx   /consultations — booking interface
│   │   │   ├── ManagerDashboard.jsx    /manager/* — manager dashboard (Phase 2)
│   │   │   ├── ProfilePage.jsx         /profile — user settings
│   │   │   └── NotFoundPage.jsx        404 page
│   │   │
│   │   ├── components/                 Reusable UI components
│   │   │   ├── layouts/
│   │   │   │   ├── MainLayout.jsx      Header + sidebar + main area
│   │   │   │   ├── AuthLayout.jsx      Centered form layout
│   │   │   │   └── DashboardLayout.jsx Dashboard-specific layout
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx          Styled button component
│   │   │   │   ├── Card.jsx            Card wrapper
│   │   │   │   ├── Modal.jsx           Modal dialog
│   │   │   │   ├── Toast.jsx           Toast notification
│   │   │   │   ├── Spinner.jsx         Loading spinner
│   │   │   │   └── Avatar.jsx          User avatar display
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.jsx       Email/password form
│   │   │   │   ├── SignupForm.jsx      Registration form
│   │   │   │   └── OAuthButton.jsx     Google sign-in button
│   │   │   ├── dashboard/
│   │   │   │   ├── WellnessGauge.jsx   Circular score display
│   │   │   │   ├── StreakCounter.jsx   Consistency tracker
│   │   │   │   ├── TrendChart.jsx      Line chart (Recharts)
│   │   │   │   └── QuickStats.jsx      KPI cards
│   │   │   ├── employee/
│   │   │   │   ├── EmployeeTable.jsx   Data table with sorting/filtering
│   │   │   │   ├── EmployeeForm.jsx    Create/edit employee
│   │   │   │   └── BulkImportModal.jsx CSV upload + mapping
│   │   │   ├── recording/
│   │   │   │   ├── AudioRecorder.jsx   Audio input + waveform display
│   │   │   │   ├── WaveformVisualizer.jsx Real-time waveform animation
│   │   │   │   └── RecordingTimer.jsx  Recording duration display
│   │   │   ├── results/
│   │   │   │   ├── ResultsCard.jsx     Assessment results summary
│   │   │   │   ├── InsightsList.jsx    Key findings list
│   │   │   │   └── WellnessTips.jsx    Actionable recommendations
│   │   │   ├── consultations/
│   │   │   │   ├── ConsultationForm.jsx Booking form with date picker
│   │   │   │   ├── ConsultationCard.jsx Upcoming/past event card
│   │   │   │   └── MeetJoinButton.jsx  Deep link to Google Meet
│   │   │   └── manager/                (Phase 2)
│   │   │       ├── TeamOverview.jsx    Team wellness summary
│   │   │       ├── TeamMemberGrid.jsx  Anonymized team cards
│   │   │       ├── TeamTrendChart.jsx  Historical trend with annotations
│   │   │       └── NudgePanel.jsx      Manager actionable nudges
│   │   │
│   │   ├── hooks/                      Custom React hooks
│   │   │   ├── useAuth.js              Auth state + login/logout
│   │   │   ├── useApi.js               API calls + loading/error states
│   │   │   ├── useLocalStorage.js      Browser storage persistence
│   │   │   ├── useDebounce.js          Debounce hook
│   │   │   └── usePagination.js        Cursor-based pagination
│   │   │
│   │   ├── context/                    React Context for state management
│   │   │   ├── AuthContext.jsx         Authentication state
│   │   │   ├── NotificationContext.jsx Toast/alert state
│   │   │   └── ModalContext.jsx        Global modal state
│   │   │
│   │   ├── services/                   API client functions
│   │   │   ├── api.js                  Axios instance + interceptors
│   │   │   ├── authService.js          Login, logout, token refresh
│   │   │   ├── sessionService.js       Assessment CRUD
│   │   │   ├── employeeService.js      Employee management
│   │   │   ├── consultationService.js  Consultation booking
│   │   │   ├── calendarService.js      Calendar sync
│   │   │   ├── analyticsService.js     Metrics + reporting
│   │   │   └── managerService.js       Manager dashboard APIs (Phase 2)
│   │   │
│   │   ├── styles/                     Global styles
│   │   │   ├── index.css               Tailwind + custom CSS
│   │   │   ├── variables.css           Design tokens (colors, spacing)
│   │   │   └── animations.css          Reusable animations
│   │   │
│   │   └── utils/                      Helper functions
│   │       ├── formatters.js           Date, number formatting
│   │       ├── validators.js           Input validation
│   │       └── constants.js            Role names, status enums
│   │
│   └── public/                         Static assets
│       ├── logo.svg                    Brand logo
│       ├── favicon.ico                 Browser tab icon
│       └── manifest.json               PWA manifest
│
├── infra/                              ============ INFRASTRUCTURE ============
│   ├── docker-compose.yml              Local development: MongoDB, Redis, all services
│   ├── migrations/
│   │   └── 001_create_indexes.js       MongoDB index creation script
│   │
│   └── scripts/
│       ├── backup_database.sh          MongoDB backup to S3
│       ├── restore_database.sh         Restore from backup
│       └── deploy.sh                   (Optional) Railway deployment script
│
├── docs/                               ============ DOCUMENTATION ============
│   ├── API.md                          REST API specification
│   ├── DEPLOYMENT.md                   Railway deployment guide
│   ├── ARCHITECTURE.md                 System design document
│   ├── SECURITY.md                     Security policies + audit
│   ├── DATABASE.md                     MongoDB schema documentation
│   └── TROUBLESHOOTING.md              Common issues + solutions
│
└── .github/                            ============ CI/CD WORKFLOWS ============
    └── workflows/
        ├── test.yml                    Run tests on every PR
        ├── build.yml                   Build and push Docker images
        ├── deploy.yml                  Deploy to Railway on merge to main
        └── lint.yml                    Code quality checks (ESLint, Prettier)
```

---

## File Count & Statistics

| Service | Files | Lines of Code | Purpose |
|---------|-------|---------------|---------|
| **api** | 45+ | 8,000+ | REST API server |
| **vococore** | 15+ | 2,000+ | Python ML engine |
| **worker** | 20+ | 3,500+ | Background jobs |
| **healthcheck** | 15+ | 2,000+ | Health monitoring |
| **web** | 50+ | 6,000+ | React frontend |
| **infra** | 5+ | 500+ | DevOps & migrations |
| **docs** | 6+ | 2,000+ | Documentation |
| **Total** | 150+ | 25,000+ | Complete platform |

---

## Key Implementation Details by Service

### API (Node.js + Express)
- **Controllers:** Handle HTTP requests → business logic
- **Services:** Encapsulate complex business logic, external API calls
- **Models:** Mongoose schemas with validations + hooks
- **Middleware:** Auth, error handling, logging, rate limiting
- **Routes:** RESTful endpoints with path parameters, query strings
- **Utils:** Reusable helpers (validators, security, pagination)

### VocaCore (Python + Flask)
- **App.py:** Flask routes `/extract` and `/health`
- **Models:** Feature extraction, inference, post-processing
- **Training:** SOTA model training pipeline (optional for custom models)
- **Tests:** Unit tests for feature extraction + inference

### Worker (Node.js + Bull)
- **Queues:** 5 Bull queues for parallel processing
- **Processors:** Job handlers for each queue type
- **Cron:** Scheduled tasks (daily reminders, reports)
- **Services:** VocaCore client, email, storage, alerting

### Healthcheck (Node.js + Express)
- **Checks:** Parallel health probes (MongoDB, Redis, API, VocaCore)
- **Alerts:** Debounced email alerts on service degradation
- **Routes:** JSON API + HTML status page
- **Metrics:** Prometheus-style metrics endpoint

### Web (React + Vite)
- **Pages:** Route-matched page components
- **Components:** Reusable UI components (buttons, forms, charts)
- **Hooks:** Custom React hooks for API, auth, localStorage
- **Context:** Global state management (auth, notifications)
- **Services:** API client functions + interceptors
- **Styles:** Tailwind CSS + custom animations

### Infrastructure
- **docker-compose.yml:** Development environment (MongoDB, Redis)
- **migrations/:** Database index creation, schema versioning
- **scripts/:** Deployment, backup, utility scripts
- **.github/workflows:** CI/CD pipelines (test, build, deploy)

---

## Development Workflow

### First Time Setup
```bash
# Clone
git clone https://github.com/CittaaHealthServices/vocalysis-platform.git
cd vocalysis-platform

# Infrastructure
docker-compose -f infra/docker-compose.yml up -d

# Services (each in new terminal)
cd vococore && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && flask run --port 5001

cd api && npm ci && npm run dev

cd web && npm ci && npm run dev

cd worker && npm ci && npm run worker
```

### Before Committing
```bash
# Format code
npm run format

# Run tests
npm run test

# Lint
npm run lint

# Check types (if TypeScript)
npm run type-check
```

### Deployment to Railway
```bash
# Push to GitHub (triggers CI/CD)
git add .
git commit -m "Feature: add manager dashboard"
git push origin main

# Railway automatically:
# 1. Runs tests
# 2. Builds all 5 services
# 3. Deploys to production
# 4. Runs database migrations (if needed)
# 5. Health checks all endpoints
```

---

## Database Indexes (MongoDB)

See `infra/migrations/001_create_indexes.js` for:
- User unique constraint on (tenantId, email)
- Employee composite index on (tenantId, departmentId)
- Session index on (tenantId, sessionDate)
- Alert index on (tenantId, status, triggeredAt)
- And 15+ more for performance

---

## Environment Variables Hierarchy

**Production (Railway):**
- Set via Railway dashboard
- Encrypted at rest
- Never logged or exposed

**Development (Local):**
- Copy `.env.example` to `.env`
- Fill in actual values
- Never commit `.env`
- Use `.gitignore` to prevent accidents

**Testing (CI):**
- Set via GitHub Actions secrets
- Used in workflows
- Never stored in code

---

## Security Considerations

- **Encryption:** AES-256 for sensitive fields + bcrypt for passwords
- **Authentication:** JWT with 8h access tokens + 7d refresh cookies
- **Authorization:** Row-level (tenantId) + role-based (RBAC) + column-level masking
- **API Keys:** Hashed storage + rotation support
- **Audit:** All user actions logged with timestamp + context
- **Rate Limiting:** 100 req/min per IP
- **CORS:** Strict origin validation
- **DPDP Compliance:** Audio deleted after processing, zero transcription
- **Error Handling:** No stack traces leaked to clients

---

## Phase 1 vs Phase 2 Additions

### Phase 1 (Current — deployed)
- 5 core services (API, VocaCore, Worker, Healthcheck, Web)
- User authentication + role-based access
- Employee management (CRUD, bulk import)
- Voice assessment recording + analysis
- Consultation booking with Google Calendar
- Alert generation for clinicians
- Audit logging
- Health monitoring

### Phase 2 (Ready to build — after Phase 1)
- React Native mobile app (iOS + Android)
- WhatsApp Business bot for assessments
- Manager wellness dashboard (anonymized)
- ManagerNudge schema + nudge engine
- New API endpoints for manager features
- New WhatsApp webhook handler

---

## File Naming Conventions

- **Services:** `serviceName.js` or `serviceName.py`
- **Controllers:** `entityController.js`
- **Models:** `Entity.js` (singular, capitalized)
- **Routes:** `entity.js` (singular, lowercase)
- **Utils:** `helperType.js` (descriptive)
- **Tests:** `*.test.js` or `*.spec.js`
- **Components:** `ComponentName.jsx` (PascalCase)
- **Hooks:** `useHookName.js` (camelCase with 'use' prefix)

---

## Deployment Checklist

Before going live:
- [ ] All secrets in Railway environment variables
- [ ] MongoDB Atlas cluster created + IP whitelist configured
- [ ] Redis instance running (Railway plugin or external)
- [ ] Google Cloud OAuth credentials set
- [ ] SMTP email credentials verified
- [ ] Database migration run: `node infra/migrations/001_create_indexes.js`
- [ ] Health checks passing: `https://api.vocalysis.cittaa.in/v1/health`
- [ ] Web app loads at custom domain
- [ ] Login flow works end-to-end
- [ ] Sample assessment workflow tested
- [ ] Alerts working
- [ ] Audit logs being created
- [ ] Status page online

---

**Last Updated:** March 2026
**Maintained By:** Cittaa Health Services Engineering Team
