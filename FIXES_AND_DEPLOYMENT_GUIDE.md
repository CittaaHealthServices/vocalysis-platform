# Vocalysis Platform — Bug Fixes & Railway Deployment Guide
> Generated: 2026-03-30 | Priority: Fix these before sharing HR access

---

## ⚠️ IMPORTANT: GitHub Token Exposed
The GitHub PAT shared in chat must be **revoked immediately** at:
https://github.com/settings/tokens
Generate a new token after revoking.

---

## 🐛 BUGS FOUND & FIXED

### Bug 1 — CORS Errors (API rejects all frontend requests)
**File:** `api/src/app.js` (line ~44)

**Problem:** Code reads `process.env.CORS_ORIGINS` but Railway env var is named `CORS_ALLOWED_ORIGINS`. Since the variable name doesn't match, CORS defaults to `http://localhost:3000` — blocking all production requests from `https://vocalysis.cittaa.in`.

**Fix applied:** See `api/src/app.js.FIXED`

**To apply:** Copy `api/src/app.js.FIXED` → replace `api/src/app.js`
```bash
cp api/src/app.js.FIXED api/src/app.js
```

**Code change:** Was:
```js
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
```
Now:
```js
const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:5173'
).split(',').map(o => o.trim());
```

---

### Bug 2 — Audio Analysis Failing (vococore can't process audio files)
**File:** `vococore/railway.toml`

**Problem:** `builder = "NIXPACKS"` skips the Dockerfile. The Dockerfile installs `ffmpeg` and `libsndfile1` — system libraries required by librosa/pydub to process audio. Without them, every audio file upload fails.

**Fix applied:** See `vococore/railway.toml.FIXED`

**To apply:** Copy `vococore/railway.toml.FIXED` → replace `vococore/railway.toml`
```bash
cp vococore/railway.toml.FIXED vococore/railway.toml
```

**Change:** Was `builder = "NIXPACKS"` → Now `builder = "DOCKERFILE"`

---

## 🚀 RAILWAY ENVIRONMENT VARIABLES CHECKLIST

Go to each Railway service → **Variables** tab and set these:

### API Service (`api/`)
| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | *(Railway sets auto)* | Don't set manually |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas URI |
| `REDIS_URL` | *(Railway Redis plugin auto-fills)* | Add Redis plugin to project |
| `JWT_ACCESS_SECRET` | 64-char random hex | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Different 64-char hex | Must be different from ACCESS |
| `JWT_ACCESS_EXPIRY` | `8h` | |
| `JWT_REFRESH_EXPIRY` | `7d` | |
| `ENCRYPTION_KEY` | 32-char random hex | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `VOCOCORE_SERVICE_URL` | *(vococore Railway URL)* | **CRITICAL** — see below |
| `VOCOCORE_INTERNAL_KEY` | Same as vococore's key | Must match exactly |
| `CORS_ALLOWED_ORIGINS` | `https://vocalysis.cittaa.in,http://localhost:5173` | Your web app URL |
| `CLIENT_URL` | `https://vocalysis.cittaa.in` | |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | `noreply@cittaa.in` | |
| `SMTP_PASS` | Gmail App Password | |
| `EMAIL_FROM` | `noreply@vocalysis.cittaa.in` | |
| `SEED_ADMIN` | `true` | Only first deploy — removes itself |
| `SEED_ADMIN_EMAIL` | `admin@cittaa.in` | Super admin login |
| `SEED_ADMIN_PASSWORD` | `Cittaa@Admin2026!` | Change after first login |

### vococore Service (`vococore/`)
| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | *(Railway sets auto)* | Don't set manually |
| `VOCOCORE_INTERNAL_KEY` | Same as API's key | Must match exactly |
| `FLASK_ENV` | `production` | |

### Web Service (`web/`)
| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://your-api-service.railway.app` | **CRITICAL** — your API Railway URL |
| `VITE_APP_NAME` | `Vocalysis` | |
| `VITE_SUPPORT_EMAIL` | `support@cittaa.in` | |

---

## 🔑 HOW TO GET THE VOCOCORE RAILWAY URL

1. Go to Railway dashboard → your project
2. Click on the **vococore** service
3. Go to **Settings** → **Domains** → copy the public URL
4. Paste that URL as `VOCOCORE_SERVICE_URL` in the **API** service variables

Example: `VOCOCORE_SERVICE_URL=https://vococore-production-xxxx.up.railway.app`

---

## 👥 CREATING HR USER ACCOUNTS

### Option A — Quick (via seed endpoint)
POST to your API URL:
```
POST https://your-api.railway.app/dev/seed
Content-Type: application/json

{ "secret": "cittaa-seed-2024" }
```

This creates these accounts (all with password `TestPass@1234!`):
| Email | Role | Dashboard |
|-------|------|-----------|
| `hr.admin@cittaa.in` | HR_ADMIN | HR Analytics, Employee List, Alerts |
| `company.admin@cittaa.in` | COMPANY_ADMIN | Company settings, manage HR admins |
| `clinician@cittaa.in` | CLINICAL_PSYCHOLOGIST | Patient registry, assessments |
| `employee@cittaa.in` | EMPLOYEE | Wellness check-ins |

**After creating:** Ask HR to change password immediately after first login.

### Option B — Super Admin creates real users
1. Log in as super admin: `admin@cittaa.in` / `Cittaa@Admin2026!`
2. Go to Admin → Tenant Management → create HR user with real email
3. User gets email invite to set their own password

---

## 📋 DEPLOYMENT STEPS (After Fixing Bugs)

1. **Apply the fixes:**
   ```bash
   cp api/src/app.js.FIXED api/src/app.js
   cp vococore/railway.toml.FIXED vococore/railway.toml
   ```

2. **Commit and push:**
   ```bash
   git add api/src/app.js vococore/railway.toml
   git commit -m "fix: CORS env var name and vococore DOCKERFILE builder"
   git push origin main
   ```

3. **Set Railway env vars** for all 3 services (API, vococore, web) per checklist above

4. **Redeploy all services** in Railway (they should auto-deploy on push)

5. **Create HR accounts** using seed endpoint once API is running

6. **Test:** Visit your web URL, log in as `hr.admin@cittaa.in`

---

## 🩺 HEALTH CHECK URLs (Test after deploy)
- API health: `https://your-api.railway.app/health`
- vococore health: `https://your-vococore.railway.app/health`
- Web: `https://your-web.railway.app`

---

## ❓ STILL HAVING ISSUES?

Check Railway logs for each service:
- Railway → Service → **Deployments** → click latest → **View Logs**
- Common errors to look for:
  - `Cannot find module` → missing env vars or dependencies
  - `MongoServerError` → MongoDB URI wrong or IP not whitelisted in Atlas
  - `Error: CORS blocked` → CORS_ALLOWED_ORIGINS not set
  - `ECONNREFUSED 5001` → VOCOCORE_SERVICE_URL wrong

