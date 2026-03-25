# Vocalysis Platform 2.0 - React + Vite Frontend

Complete React + Vite frontend for Vocalysis Platform 2.0 with all 5 dashboards, advanced features, and clinical-grade UI/UX.

## Architecture Overview

### Dashboards (5 Total)

1. **Clinical Dashboard** - SENIOR_CLINICIAN / CLINICAL_PSYCHOLOGIST
   - Patient assessment management
   - Real-time results analysis
   - Clinical alerts & consultations
   - Comprehensive session results with biomarker analysis

2. **HR Dashboard** - HR_ADMIN
   - Employee wellness overview
   - Bulk employee import
   - Department management
   - Assessment scheduling

3. **Company Dashboard** - COMPANY_ADMIN
   - Organizational metrics
   - HR admin management
   - Department overview
   - Billing & API keys

4. **Employee Portal** - EMPLOYEE
   - Wellness self-check-ins
   - Personal health history
   - Resource library
   - Consultation booking

5. **Cittaa Super Admin** - CITTAA_SUPER_ADMIN
   - Multi-tenant platform management
   - Company onboarding wizard
   - System health monitoring
   - Audit & error logging

## Key Features

### Audio Recording & Processing
- Real-time waveform visualization (wavesurfer.js)
- Audio quality indicators (level, noise detection)
- Live processing pipeline with progress tracking
- Automatic session result generation

### Charts & Analytics
- Semi-circular score gauges (ScoreGauge)
- Radar charts for wellness dimensions (WellnessWheel)
- Animated trend lines with clinical bands (TrendLine)
- Risk distribution donut charts (RiskDonut)

### Clinical Features
- Multi-step assessment wizard
- Complete session results with biomarker findings
- Trend analysis & longitudinal tracking
- Clinician notes & validation score inputs
- Google Meet integration for consultations

### User Management
- Role-based access control (6 roles)
- Protected route authentication
- Token refresh with auto-retry
- Secure httpOnly cookie handling

### Consultation Booking
- Availability checking system
- Multi-mode support (online/offline)
- Google Calendar integration (optional)
- Confirmation & calendar invites

## Project Structure

```
web/
├── src/
│   ├── main.jsx                 # App entry point
│   ├── index.css                # Tailwind + brand styles
│   ├── router/
│   │   ├── index.jsx            # React Router 6 setup
│   │   └── ProtectedRoute.jsx   # Auth guard component
│   ├── context/
│   │   └── AuthContext.jsx      # Authentication & token management
│   ├── services/
│   │   └── api.js               # Axios instance with interceptors
│   ├── hooks/
│   │   ├── useAuth.js           # Auth context hook
│   │   ├── useApi.js            # React Query wrappers
│   │   └── usePolling.js        # Long-polling for async operations
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── Button.jsx, Input.jsx, Modal.jsx, etc.
│   │   │   └── index.js         # Barrel export
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx    # Main layout container
│   │   │   ├── Sidebar.jsx      # Role-specific navigation
│   │   │   └── TopNav.jsx       # Header with user menu
│   │   ├── charts/
│   │   │   ├── ScoreGauge.jsx   # Severity gauge
│   │   │   ├── WellnessWheel.jsx
│   │   │   ├── TrendLine.jsx
│   │   │   └── RiskDonut.jsx
│   │   ├── audio/
│   │   │   └── WaveformRecorder.jsx
│   │   ├── alerts/
│   │   │   └── AlertCard.jsx
│   │   └── consultations/
│   │       ├── ConsultationBookingModal.jsx
│   │       └── ConsultationCard.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── ResetPassword.jsx
│   │   ├── clinical/            # Clinical dashboard (9 pages)
│   │   ├── hr/                  # HR dashboard (5 pages)
│   │   ├── employee/            # Employee portal (6 pages)
│   │   ├── company/             # Company dashboard (6 pages)
│   │   ├── cittaa-admin/        # Super admin (9 pages)
│   │   └── errors/              # Error pages
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Update VITE_API_URL if needed
# Default: http://localhost:3001/api

# Start dev server
npm run dev
```

Dev server runs on `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Configuration

### Environment Variables

```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Vocalysis
VITE_BRAND_COLOR=#6B21A8
VITE_ENVIRONMENT=development
```

### Tailwind Theme

Cittaa brand colors configured in `tailwind.config.js`:
- Primary: `#6B21A8` (Cittaa Purple)
- Secondary: `#0EA5E9` (Clinical Blue)
- Status colors: Success, Warning, Danger

## API Integration

All API calls through centralized `api.js`:

### Features
- Request interceptor: Auto-attach access token
- Response interceptor: Handle 401 with token refresh
- Error normalization: Consistent error structure
- Browser cookies: Auto-managed httpOnly refresh tokens

### Usage

```javascript
import api from '@/services/api'
import { useApi } from '@/hooks/useApi'

// Direct call
await api.post('/endpoint', data)

// React Query hook
const { data, isLoading } = useApi(
  ['query-key'],
  () => api.get('/endpoint')
)

// Mutation
const mutation = useApiMutation(
  (data) => api.post('/endpoint', data),
  { successMessage: 'Success!' }
)
```

## Components

### UI Components
All in `src/components/ui/`:
- **Button** - Primary, secondary, danger, ghost, outline
- **Input** - Text, email, password with validation
- **Select** - Dropdown with searchable options
- **Modal** - Portal-based with keyboard support
- **Card** - Reusable container with header/footer
- **Table** - Sortable, selectable, paginated
- **Badge** - Status, severity, role indicators
- **Tabs** - Multi-section container
- **Spinner** - Loading indicator
- **EmptyState** - Placeholder with action

### Layout
- **AppLayout** - Main container with sidebar + top nav
- **Sidebar** - Role-specific navigation
- **TopNav** - User menu, notifications, impersonation banner

### Charts
- **ScoreGauge** - Semi-circular severity indicator
- **WellnessWheel** - 6D radar chart
- **TrendLine** - Animated line chart with reference bands
- **RiskDonut** - Risk distribution pie chart

## Authentication Flow

1. User logs in with email/password
2. API returns access token + refresh token (in httpOnly cookie)
3. Access token stored in memory (AuthContext)
4. Interceptor attaches token to requests
5. If 401: Attempt refresh using httpOnly cookie
6. On failure: Clear auth, redirect to login

## Role-Based Access

```javascript
const ROLES = {
  CITTAA_SUPER_ADMIN: 'CITTAA_SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  SENIOR_CLINICIAN: 'SENIOR_CLINICIAN',
  CLINICAL_PSYCHOLOGIST: 'CLINICAL_PSYCHOLOGIST',
  EMPLOYEE: 'EMPLOYEE',
}
```

Each role automatically routed to appropriate dashboard.

## Features Implemented

✅ Complete authentication system
✅ 5 distinct dashboards with role-based access
✅ 35+ pages fully implemented
✅ Audio recording with real-time waveform
✅ Assessment wizard (5-step multi-stage)
✅ Session results with clinical analysis
✅ Patient longitudinal profiles
✅ Consultation booking with availability
✅ Alert management system
✅ Bulk employee import
✅ Multi-tenant platform admin
✅ Health monitoring & audit logs
✅ Analytics dashboards
✅ Google Meet integration (optional)
✅ Responsive mobile design
✅ Accessibility (WCAG 2.1)

## Performance Optimizations

- Code splitting via Vite
- React Query caching (5min stale time)
- Lazy loading routes (future: React.lazy)
- Image optimization
- CSS Tailwind purging

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Guidelines

### Component Patterns

All components use:
- Functional components with hooks
- React Hook Form for forms
- Zod for validation
- Tailwind for styling
- react-hot-toast for notifications

### Naming Conventions
- Pages: PascalCase (e.g., `PatientProfile.jsx`)
- Components: PascalCase (e.g., `AlertCard.jsx`)
- Hooks: camelCase (e.g., `useAuth.js`)
- Utils: camelCase (e.g., `api.js`)

### Form Validation Example

```javascript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
})
```

## Testing (Future)

Recommended setup:
- Vitest for unit tests
- React Testing Library for components
- Cypress for E2E tests

## Deployment

### Vercel
```bash
vercel deploy
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
```

## Troubleshooting

### Auth Issues
- Clear localStorage & cookies
- Verify API endpoint in .env
- Check token refresh endpoint

### API Calls
- Check browser console for CORS errors
- Verify API server is running
- Check network tab for 401/403

### Build Issues
- Clear `node_modules` and reinstall
- Check Node version (18+)
- Verify all imports are correct

## Support

For issues or questions, contact the development team or check the API documentation.

---

**Version**: 2.0.0
**Last Updated**: 2026-03-25
**Status**: Production Ready
