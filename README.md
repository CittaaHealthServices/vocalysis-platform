# Vocalysis Platform 2.0
### Clinical Voice Biomarker Analysis Platform
**By Cittaa Health Services Private Limited, Hyderabad, India**

**Status Badges:** Node.js 20 | Python 3.11 | React 18 | MongoDB | Railway Deployment

> Vocalysis is a multi-tenant clinical platform that analyzes acoustic biomarkers
> in voice to support mental health assessment across hospitals, schools, and corporations.
> Powered by VocaCore™ Engine.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│                  vocalysis-web (Port 5173)                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│                  API Gateway (Express)                       │
│         vocalysis-api (Port 3001) — Railway Load Balancer   │
├─────────────────────┬──────────────────────┬─────────────────┤
│                     │                      │                 │
│            ┌────────▼────────┐   ┌────────▼────────┐         │
│            │ MongoDB Atlas   │   │   Redis Cache   │         │
│            │   (Shared)      │   │    (Shared)     │         │
│            └─────────────────┘   └─────────────────┘         │
│                                                               │
│   ┌──────────────────────┐    ┌──────────────────────┐       │
│   │  Bull Work Queue     │    │   Session Handler    │       │
│   │  (Jobs Processor)    │    │   (WebSocket)        │       │
│   └──────────────────────┘    └──────────────────────┘       │
└───────────┬──────────────────────────────────────────────────┘
            │
    ┌───────┼───────┬──────────────┐
    │       │       │              │
    │  ┌────▼───┐  ┌▼─────┐   ┌───▼────┐
    │  │ Worker │  │HC    │   │VocaCore│
    │  │Service │  │Check │   │Engine  │
    │  │        │  │      │   │        │
    │  └────────┘  └──────┘   └────────┘
    │  (Async)    (Monitor)   (AI/ML)
    │
    └─ Background Jobs: email, webhooks, analytics
```

---

## Services

| Service | Tech Stack | Purpose | Port | Scaling |
|---------|------------|---------|------|---------|
| **vocalysis-web** | React 18 + Vite + Tailwind | Frontend SPA | 5173 | CDN + Railway instances |
| **vocalysis-api** | Node.js 20 + Express | REST API + Auth | 3001 | Railway auto-scaling |
| **vocalysis-vococore** | Python 3.11 + Flask | Audio feature extraction | 5001 | 1-2 instances |
| **vocalysis-worker** | Node.js 20 + Bull | Async job processor | (internal) | Railway auto-scaling |
| **vocalysis-healthcheck** | Node.js 20 + Express | Platform monitoring | 4000 | Always-on |

---

## Prerequisites

Before you start, you'll need:

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Python 3.11+** — [python.org](https://www.python.org)
- **MongoDB Atlas** — Free tier at [mongodb.com/cloud](https://mongodb.com/cloud)
- **Railway Account** — [railway.app](https://railway.app)
- **Google Cloud Project** — For Calendar and Meet integration
  - Enable: Google Calendar API, Google Meet API
  - Create OAuth 2.0 credentials
- **Gemini API Key** — Store in `VOCOCORE_INFERENCE_KEY`
- **Gmail App Password** — For SMTP notifications

---

## Local Development Setup

### Step 1: Clone Repository
```bash
git clone https://github.com/CittaaHealthServices/vocalysis-platform.git
cd vocalysis-platform
```

### Step 2: Start Infrastructure
```bash
# Start MongoDB and Redis with Docker Compose
docker-compose -f infra/docker-compose.yml up -d mongodb redis
```

### Step 3: Setup VocaCore Engine (Python)
```bash
cd vococore

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env and fill in VOCOCORE_INTERNAL_KEY

# Start service
flask run --port 5001
```

### Step 4: Setup API Server (Node.js) — New Terminal
```bash
cd api

# Install dependencies
npm ci

# Copy environment template
cp .env.example .env
# Edit .env with MongoDB URI, Redis URL, secrets, etc.

# Create database indexes
node ../infra/migrations/001_create_indexes.js

# Start development server
npm run dev
```

### Step 5: Setup Frontend (React) — New Terminal
```bash
cd web

# Install dependencies
npm ci

# Copy environment template
cp .env.example .env
# Edit VITE_API_URL if needed (default: http://localhost:3001)

# Start dev server
npm run dev
```

### Verify Everything Works
```bash
# Check API health
curl http://localhost:3001/v1/health

# Check VocaCore
curl http://localhost:5001/health

# Open browser
# Web: http://localhost:5173
# API Docs: http://localhost:3001/docs
```

---

## Railway Production Deployment

### Prerequisites
- GitHub repository with all code pushed
- Railway account linked to GitHub
- MongoDB Atlas cluster created
- All environment variables ready

### Step-by-Step Deployment

#### 1. Create Railway Project
```bash
# Go to railway.app and create new project
# Select "Deploy from GitHub"
# Authorize GitHub and select this repository
```

#### 2. Add Services
In Railway dashboard, add 5 services:
- **vocalysis-web** — `/web` directory
- **vocalysis-api** — `/api` directory
- **vocalysis-vococore** — `/vococore` directory
- **vocalysis-worker** — `/worker` directory
- **vocalysis-healthcheck** — `/healthcheck` directory

#### 3. Add Databases
```
# Add MongoDB Atlas (external)
# Add Redis (Railway plugin)
```

#### 4. Configure Environment Variables
For each service, set variables from `.env.example` files:

**API Service:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vocalysis
REDIS_URL=redis://[redis-private-url]
JWT_ACCESS_SECRET=[64-byte hex]
JWT_REFRESH_SECRET=[64-byte hex]
ENCRYPTION_KEY=[32-byte hex]
VOCOCORE_INTERNAL_KEY=[32 chars]
VOCOCORE_INFERENCE_KEY=[your-gemini-api-key]
VOCOCORE_SERVICE_URL=http://vocalysis-vococore.railway.internal:5001
CLIENT_URL=https://vocalysis.cittaa.in
CORS_ALLOWED_ORIGINS=https://vocalysis.cittaa.in
GOOGLE_CLIENT_ID=[from Google Cloud]
GOOGLE_CLIENT_SECRET=[from Google Cloud]
GOOGLE_REDIRECT_URI=https://api.vocalysis.cittaa.in/auth/google/callback
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@cittaa.in
SMTP_PASS=[gmail-app-password]
EMAIL_FROM=noreply@vocalysis.cittaa.in
ALERT_EMAIL_TO=sairam@cittaa.in,rohan@cittaa.in
BULL_BOARD_PASSWORD=[strong-password]
```

**VocaCore Service:**
```
VOCOCORE_INTERNAL_KEY=[same as API]
FLASK_ENV=production
```

**Worker Service:**
```
[Same as API, omit PORT]
```

**Healthcheck Service:**
```
MONGODB_URI=[same as API]
REDIS_URL=[same as API]
API_URL=https://api.vocalysis.cittaa.in
VOCOCORE_URL=http://vocalysis-vococore.railway.internal:5001
ALERT_EMAIL_TO=sairam@cittaa.in,rohan@cittaa.in
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@cittaa.in
SMTP_PASS=[gmail-app-password]
```

#### 5. Run Database Migration
```bash
# In Railway dashboard, go to API service
# Open Railway CLI and run:
railway run node infra/migrations/001_create_indexes.js
```

#### 6. Configure Custom Domains
```
vocalysis-web.railway.app → vocalysis.cittaa.in
vocalysis-api.railway.app → api.vocalysis.cittaa.in
vocalysis-healthcheck.railway.app → status.vocalysis.cittaa.in
```

#### 7. Monitor Deployment
- Check logs in Railway dashboard
- Verify API health: https://api.vocalysis.cittaa.in/v1/health
- Test login flow in web app
- Check Bull board: https://api.vocalysis.cittaa.in/admin/queues

---

## Google Calendar & Meet Integration

### Setup in Google Cloud Console

1. **Create Project**
   - Go to https://console.cloud.google.com
   - New Project → "Vocalysis Platform"

2. **Enable APIs**
   - Search "Google Calendar API" → Enable
   - Search "Google Meet API" → Enable

3. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web Application)
   - Authorized Redirect URIs:
     ```
     https://api.vocalysis.cittaa.in/auth/google/callback
     http://localhost:3001/auth/google/callback
     ```

4. **Copy to Environment**
   ```env
   GOOGLE_CLIENT_ID=<your-client-id>
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   ```

### Users Can Now
- Sync calendar events for consultation scheduling
- Join Google Meet directly from Vocalysis
- Grant offline access for background sync

---

## Environment Variables Reference

### API (.env)
See `api/.env.example` for all variables with descriptions.

**Critical Variables:**
- `MONGODB_URI` — MongoDB Atlas connection string
- `VOCOCORE_INFERENCE_KEY` — The inference engine API key (Gemini)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `ENCRYPTION_KEY` — Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### VocaCore (Python)
See `vococore/.env.example`

### Worker (Node.js)
See `worker/.env.example`

### Healthcheck (Node.js)
See `healthcheck/.env.example`

### Web (Frontend)
See `web/.env.example`

---

## ML Model Training

For advanced users: Train custom SOTA models using your own datasets.

```bash
cd vococore/training

# Install training dependencies
pip install -r requirements.txt

# Download datasets (requires Kaggle API key in ~/.kaggle/kaggle.json)
python datasets/downloader.py --all

# Train WavLM-based model
python train_sota.py --backbone wavlm --datasets all --epochs 50

# Evaluate model
python evaluate.py --model-path models/latest.pth

# Convert to ONNX for inference
python convert_to_onnx.py --model-path models/latest.pth
```

---

## User Roles & Permissions

| Role | Access Level | Use Case |
|------|--------------|----------|
| **CITTAA_SUPER_ADMIN** | Full platform | Cittaa staff only; requires IP whitelist |
| **COMPANY_ADMIN** | Own tenant all features | HR/Admin for one company |
| **HR_ADMIN** | Department view (anonymized) | View team wellness trends only |
| **SENIOR_CLINICIAN** | All patients (clinical access) | Psychiatrist at hospital |
| **CLINICAL_PSYCHOLOGIST** | Assigned patients only | Therapist seeing specific people |
| **EMPLOYEE** | Own wellness data | Self-service check-ins |
| **API_CLIENT** | White-label API | Partner apps via API key |

**Permission Model:**
- Row-level: Always filtered by `tenantId`
- Column-level: HR roles see names + wellness category only
- Clinical data: Only accessible to clinicians with explicit access grant

---

## API Documentation

### Live Docs (when deployed)
- **OpenAPI/Swagger:** https://api.vocalysis.cittaa.in/docs
- **ReDoc:** https://api.vocalysis.cittaa.in/redoc

### Key Endpoints
```
GET    /v1/health                — Service health check
POST   /v1/auth/login            — User login
POST   /v1/auth/logout           — Logout with refresh token rotation
POST   /v1/sessions              — Submit voice assessment
GET    /v1/sessions/:id/results  — Get analysis results
POST   /v1/consultations         — Book consultation with clinician
GET    /v1/calendar/events       — Fetch synced calendar events
POST   /v1/whatsapp/webhook      — WhatsApp bot webhook (Phase 2)
```

See API service `/docs` endpoint for full OpenAPI spec.

---

## Security Features

- **Authentication:** JWT with httpOnly refresh cookies
- **Password Hashing:** bcrypt 12 rounds
- **MFA:** TOTP for super admin accounts
- **Audit Logging:** All user actions logged with timestamps
- **Data Privacy:** DPDP Act 2023 compliant
  - Audio files deleted immediately after ML feature extraction
  - Zero transcription — voice biomarkers only
  - No raw audio stored
- **Rate Limiting:** 100 requests/minute per IP
- **CORS:** Strict origin validation
- **API Keys:** Hashed storage with rotation support

---

## Troubleshooting

### MongoDB Connection Fails
```bash
# Check connection string format:
# mongodb+srv://username:password@cluster.mongodb.net/vocalysis

# Verify IP whitelist includes your machine
# https://cloud.mongodb.com → Network Access
```

### VocaCore Service Crashes
```bash
# Check Python dependencies installed
pip list | grep -E "flask|torch|librosa"

# Check VOCOCORE_INTERNAL_KEY matches API
echo $VOCOCORE_INTERNAL_KEY
```

### API Won't Start
```bash
# Check Node version
node --version  # Should be 20+

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm ci

# Check .env file exists and is readable
cat api/.env | head
```

### Frontend Build Fails
```bash
# Ensure VITE_API_URL is set correctly
cat web/.env

# Clear Vite cache
rm -rf web/dist web/.vite

# Rebuild
npm run build
```

---

## Monitoring & Alerts

### Health Dashboard
- **URL:** https://status.vocalysis.cittaa.in
- **Updates Every:** 1 minute
- **Checks:**
  - MongoDB connectivity
  - Redis connectivity
  - API responsiveness
  - VocaCore service availability
  - Email delivery system

### Alerts
Sent to `ALERT_EMAIL_TO` when:
- Any service becomes unavailable (5+ min)
- Database connection failures
- High API latency (>2 sec)
- Worker job failures
- Low disk space (>90% used)

### Bull Queue Dashboard
```
https://api.vocalysis.cittaa.in/admin/queues
Password: [BULL_BOARD_PASSWORD from env]
```

View real-time job queues, retries, and failures.

---

## Phase 2 (Coming Soon)

For detailed Phase 2 specifications, see [PHASE_2_SPEC.md](./PHASE_2_SPEC.md).

Planned features:
- **React Native Mobile App** — iOS + Android self-service assessments
- **WhatsApp Bot** — Voice note assessment via WhatsApp
- **Manager Dashboard** — Aggregate team wellness insights (privacy-first)

---

## Contact & Support

- **API Support:** api@cittaa.in
- **Technical Lead:** sairam@cittaa.in
- **Product:** rohan@cittaa.in
- **Status Page:** https://status.vocalysis.cittaa.in

---

## License & Ownership

© 2024-2026 Cittaa Health Services Private Limited, Hyderabad, India.

All code, documentation, and infrastructure configurations are proprietary.

---

**Last Updated:** March 2026
**Version:** 2.0.0
