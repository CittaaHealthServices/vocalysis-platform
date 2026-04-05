# Vocalysis Platform 2.1
### Clinical Voice Biomarker Analysis Platform
**By Cittaa Health Services Private Limited, Hyderabad, India**

[![Status](https://img.shields.io/badge/status-production-brightgreen)](https://api.mindbridge.cittaa.in/v1/health)
[![Node.js](https://img.shields.io/badge/node-20-blue)](https://nodejs.org)
[![Python](https://img.shields.io/badge/python-3.11-blue)](https://python.org)
[![React](https://img.shields.io/badge/react-18-61DAFB)](https://react.dev)
[![Railway](https://img.shields.io/badge/deployed-railway-purple)](https://railway.app)

> Vocalysis is a multi-tenant B2B SaaS platform that analyses acoustic biomarkers in voice
> to deliver clinical-grade mental health screening (PHQ-9, GAD-7, PSS-10) at enterprise scale.
> Designed and calibrated for India's multilingual workforce.

---

## Live Production Services

| Service | URL | Status |
|---------|-----|--------|
| Web App | https://app.vocalysis.cittaa.in | ✅ Live |
| API Gateway | https://api.mindbridge.cittaa.in | ✅ Live |
| VocoCore™ Engine | https://ml.mindbridge.cittaa.in | ✅ Live |
| Voice AI Service | Internal Railway service | ✅ Live |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React 18 + Vite)                    │
│               app.vocalysis.cittaa.in  (Railway)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│              API Gateway  (Express + Node.js 20)                 │
│             api.mindbridge.cittaa.in  (Railway)                  │
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  MongoDB Atlas   │  │  Redis (Bull)   │  │  JWT + DPDP   │  │
│  │  Multi-tenant    │  │  Job Queues     │  │  Auth Layer   │  │
│  └──────────────────┘  └─────────────────┘  └───────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Internal queues
┌──────────────────────────▼──────────────────────────────────────┐
│              Worker Service  (Node.js 20 + Bull)                 │
│                        (Railway)                                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Voice Analysis Fallback Chain                  │ │
│  │                                                            │ │
│  │  Tier 1: VocoCore™  →  96.4% accuracy, Indian ML ensemble │ │
│  │  Tier 2: VocoCore™ /fallback  →  Deterministic scorer     │ │
│  │  Tier 3: Cittaa Voice AI  →  FDA-research voice biomarker  │ │
│  │  Tier 4: Gemini AI  →  LLM-based acoustic analysis        │ │
│  │  Tier 5: Deterministic  →  Rule-based fallback            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
    ┌──────────────────────┼─────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌────────────┐    ┌─────────────────┐    ┌────────────────┐
│ VocoCore™  │    │  Cittaa Voice   │    │  Healthcheck   │
│  Engine    │    │  AI Service     │    │  Monitor       │
│  (Python)  │    │  (Python)       │    │  (Node.js)     │
│  Flask +   │    │  Flask +        │    │                │
│  gunicorn  │    │  gunicorn       │    │                │
│            │    │                 │    │                │
│ ml.mind-   │    │  Internal URL   │    │ status.vocal-  │
│ bridge.    │    │  (Railway)      │    │ ysis.cittaa.in │
│ cittaa.in  │    │                 │    │                │
└────────────┘    └─────────────────┘    └────────────────┘
```

---

## Services

| Service | Tech Stack | Purpose | Railway Service |
|---------|------------|---------|-----------------|
| **vocalysis-web** | React 18 + Vite + Tailwind | Frontend SPA | vocalysis-platform |
| **vocalysis-api** | Node.js 20 + Express | REST API + Auth | vocalysis-platform |
| **vococore** | Python 3.11 + Flask + scikit-learn | VocoCore™ ML inference | merry-tranquility |
| **vocalysis-worker** | Node.js 20 + Bull | Async job processor + voice analysis | vocalysis-platform |
| **voice-ai-service** | Python 3.11 + Flask + PyTorch | Cittaa proprietary voice biomarker AI | radiant-bravery |
| **healthcheck** | Node.js 20 + Express | Platform monitoring | vocalysis-platform |

---

## VocoCore™ Engine

Cittaa's proprietary acoustic intelligence engine. Built from the ground up for the Indian multilingual workforce.

**Model Performance:**
- **Accuracy:** 96.4% on Indian mental health screening
- **F1 Score:** 96.45%  |  **AUC:** 0.9955
- **Training Data:** 12,000+ Indian voice samples
- **Languages:** Hindi, Telugu, Tamil, Kannada, Indian English
- **Demographics:** Blue-collar 40% | White-collar 40% | Mixed 20%

**Clinical Outputs (VocoScale™):**

| Scale | Measures | Range |
|-------|----------|-------|
| PHQ-9 | Depression severity | 0 – 27 |
| GAD-7 | Anxiety severity | 0 – 21 |
| PSS-10 | Stress / allostatic load | 0 – 40 |

**Voice Analysis Pipeline:**
1. 68 acoustic biomarkers extracted per session
2. Language auto-detection (10 Indian languages)
3. Per-language calibration applied (Indian norms, not Western defaults)
4. Ensemble ML inference (XGBoost + RandomForest voting)
5. VocoScale™ clinical score mapping

---

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Python 3.11+** — [python.org](https://www.python.org)
- **MongoDB Atlas** — Free tier at [mongodb.com/cloud](https://mongodb.com/cloud)
- **Redis** — Local or Railway plugin
- **Railway Account** — [railway.app](https://railway.app)
- **Gemini API Key** — For Tier 4 AI fallback (`VOCOCORE_INFERENCE_KEY`)
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
docker-compose -f infra/docker-compose.yml up -d mongodb redis
```

### Step 3: Setup VocoCore™ Engine (Python)
```bash
cd vococore
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

# Start service
gunicorn app:app --config gunicorn.conf.py
# Or for dev:
flask run --port 8080
```

### Step 4: Setup API Server
```bash
cd api
npm ci
cp .env.example .env
# Edit .env — fill MongoDB URI, Redis URL, secrets

node ../infra/migrations/001_create_indexes.js
npm run dev
```

### Step 5: Setup Worker
```bash
cd worker
npm ci
cp .env.example .env
# Edit .env — same as API
npm start
```

### Step 6: Setup Frontend
```bash
cd web
npm ci
cp .env.example .env
# Edit VITE_API_URL if needed (default: http://localhost:3001)
npm run dev
```

### Verify Everything Works
```bash
curl http://localhost:3001/v1/health     # API
curl http://localhost:8080/health        # VocoCore
# Web: http://localhost:5173
```

---

## Railway Production Deployment

### Services to Deploy

| Directory | Service Name | Root Directory |
|-----------|-------------|----------------|
| `api/` | API Gateway | `api` |
| `worker/` | Worker Service | `worker` |
| `web/` | Frontend | `web` |
| `vococore/` | VocoCore™ Engine | `vococore` |
| `kintsugi-service/` | Voice AI Service | `kintsugi-service` |
| `healthcheck/` | Healthcheck | `healthcheck` |

### Key Environment Variables

**Worker & API Services:**
```env
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=[64-byte hex]
JWT_REFRESH_SECRET=[64-byte hex]
ENCRYPTION_KEY=[32-byte hex]
VOCOCORE_INTERNAL_KEY=[shared secret]
VOCOCORE_SERVICE_URL=https://ml.mindbridge.cittaa.in
VOCOCORE_INFERENCE_KEY=[gemini-api-key]
KINTSUGI_SERVICE_URL=[voice-ai-service-railway-url]
KINTSUGI_INTERNAL_KEY=[voice-ai-internal-secret]
CLIENT_URL=https://app.vocalysis.cittaa.in
```

**VocoCore™ Service:**
```env
VOCOCORE_INTERNAL_KEY=[same as above]
GUNICORN_WORKERS=1
GUNICORN_THREADS=2
ELEVENLABS_API_KEY=[optional — enables auto-retraining]
```

**Voice AI Service:**
```env
KINTSUGI_INTERNAL_KEY=[same as above]
PORT=8001
```

### Generate Secrets
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # Encryption key
```

---

## Voice Analysis Fallback Chain

When a voice session is submitted, the worker attempts each tier in sequence:

```
1. VocoCore™ /score        → Indian ML ensemble (96.4% acc)
      ↓ (on failure)
2. VocoCore™ /fallback     → Deterministic acoustic scoring
      ↓ (on failure)
3. Cittaa Voice AI          → Proprietary voice biomarker model
      ↓ (on failure)
4. Gemini AI                → LLM-based acoustic + linguistic analysis
      ↓ (on failure)
5. Deterministic fallback   → Rule-based scoring (always succeeds)
```

Each tier logs `scorerUsed` on the session document for audit and quality tracking.

---

## User Roles & Permissions

| Role | Access Level | Use Case |
|------|-------------|---------|
| **CITTAA_SUPER_ADMIN** | Full platform | Cittaa staff only |
| **COMPANY_ADMIN** | Own tenant, all features | HR/Admin for one company |
| **HR_ADMIN** | Anonymised department view | Team wellness trends |
| **SENIOR_CLINICIAN** | All patients in tenant | Psychiatrist |
| **CLINICAL_PSYCHOLOGIST** | Assigned patients only | Therapist |
| **EMPLOYEE** | Own wellness data | Self-service check-ins |
| **API_CLIENT** | White-label API | Partner apps |

**Permission Model:**
- Row-level: Always filtered by `tenantId`
- HR roles: Anonymised names + wellness category only
- Clinical data: Clinicians with explicit access grant only
- Audio: Deleted immediately after feature extraction — zero raw audio stored

---

## Security

- JWT + httpOnly refresh cookies with rotation
- bcrypt password hashing (12 rounds)
- TOTP MFA for super admin
- DPDP Act 2023 compliant — no raw audio stored, zero transcription
- Rate limiting: 100 req/min per IP
- All user actions audit-logged

---

## API Reference

**Live Docs (production):** https://api.mindbridge.cittaa.in/docs

```
GET  /v1/health                  — Service health
POST /v1/auth/login              — Login
POST /v1/sessions                — Submit voice assessment
GET  /v1/sessions/:id/results    — Get analysis results
POST /v1/consultations           — Book clinician consultation
GET  /v1/reports/wellness        — Tenant wellness report
POST /v1/admin/session-feedback  — Clinician PHQ-9/GAD-7 feedback
```

---

## Troubleshooting

**VocoCore service returns 502:**
- Check Railway deploy logs for the merry-tranquility service
- Health check timeout is 180s — give it 3 minutes after first deploy
- Verify `VOCOCORE_INTERNAL_KEY` matches between API/worker and VocoCore service

**Worker audio analysis always uses fallback:**
- Check `VOCOCORE_SERVICE_URL` env var is set on the worker service
- Verify VocoCore `/health` returns `{"ml_model_loaded": true}`

**Alert escalation cron failures:**
- Check for `ObjectId cast error` — indicates legacy alerts with non-ObjectId tenantId
- Fixed in commit `f265a70` — redeploy worker if still occurring

**sklearn version warning on VocoCore startup:**
- `requirements.txt` pins `scikit-learn>=1.3.0,<1.4.0` — ensure no override
- If model was retrained, re-pin to the sklearn version used for training

---

## Monitoring

- **Health Dashboard:** https://status.vocalysis.cittaa.in
- **Bull Queue Board:** https://api.mindbridge.cittaa.in/admin/queues
- **Railway Logs:** Dashboard → each service → Deployments tab

---

## Contact

- **Founder:** Sairam — cittaagroups@gmail.com
- **Platform:** https://cittaa.in
- **Status:** https://status.vocalysis.cittaa.in

---

## License

© 2024–2026 Cittaa Health Services Private Limited, Hyderabad, India.
All code, models, and infrastructure are proprietary and confidential.

VocoCore™, VocoScale™, and Vocalysis™ are trademarks of Cittaa Health Services.

**Last Updated:** April 2026 | **Version:** 2.1.0
