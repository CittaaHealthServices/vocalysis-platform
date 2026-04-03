# Vocalysis Platform 2.0 - API Routes Quick Reference

## Base URL
```
http://localhost:3001
https://api.vocalysis.com (production)
```

## Authentication Endpoints

### POST /auth/register
Create new user (role-restricted)
```json
{
  "email": "user@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePass123!",
  "role": "HR_ADMIN",
  "tenantId": "632f...(optional)"
}
```
Response: 201 User created + welcome email sent

### POST /auth/login
```json
{
  "email": "user@company.com",
  "password": "SecurePass123!"
}
```
Response: 200 + { accessToken, refreshToken (cookie), user }

### POST /auth/refresh
Response: 200 + { accessToken }

### POST /auth/logout
Response: 200 + token blacklisted

### POST /auth/forgot-password
```json
{ "email": "user@company.com" }
```
Response: 200 + reset email sent

### POST /auth/reset-password
```json
{
  "token": "...",
  "password": "NewSecurePass123!"
}
```
Response: 200 + password updated

### POST /auth/mfa/setup
Response: 200 + { secret, qrCode, manualEntryKey }

### POST /auth/mfa/verify
```json
{
  "secret": "...",
  "totpCode": "123456"
}
```
Response: 200 + MFA enabled

### GET /auth/google
Response: 200 + { url }

### GET /auth/google/callback
Response: Redirect to /settings/integrations?google=connected

---

## Consultation Endpoints

### GET /consultations
Query params: page, limit, status, employeeId
Response: 200 + { consultations[], pagination }

### POST /consultations
```json
{
  "sessionId": "632f...(optional)",
  "employeeId": "632f...",
  "clinicianId": "632f...",
  "consultationType": "wellness_review",
  "mode": "online|inperson",
  "scheduledAt": "2026-03-26T14:00:00Z",
  "durationMinutes": 60,
  "location": "Conference Room A (optional)"
}
```
Response: 201 + { consultation, invitations sent }

### GET /consultations/:id
Response: 200 + { consultation }

### PUT /consultations/:id
```json
{
  "scheduledAt": "2026-03-27T14:00:00Z(optional)",
  "notes": "Updated notes(optional)",
  "status": "scheduled(optional)",
  "durationMinutes": 45(optional)
}
```
Response: 200 + { consultation updated }

### DELETE /consultations/:id
```json
{ "reason": "Employee requested cancellation" }
```
Response: 200 + { consultation cancelled }

### POST /consultations/:id/complete
```json
{ "clinicianNotes": "Patient shows improvement..." }
```
Response: 200 + { consultation completed }

### GET /consultations/availability/:clinicianId
Query params: date (YYYY-MM-DD), duration (minutes)
Response: 200 + { availableSlots[] }

---

## Session Endpoints

### POST /sessions
Multipart form data:
- audio: [audio file WAV/MP3]
- notes: [optional]
- employeeId: [optional, required for non-EMPLOYEE users]

Response: 201 + { sessionId, status: processing }

### GET /sessions
Query params: page, limit, status, employeeId
Response: 200 + { sessions[], pagination }

### GET /sessions/:id
Response: 200 + { session }
(Employees see only wellness output, clinicians see full data)

### PUT /sessions/:id/finalise
```json
{ "clinicianNotes": "Assessment shows..." }
```
Response: 200 + { session finalised, reportGenerated }

### GET /sessions/:id/report
Response: 200 PDF download (binary)

### DELETE /sessions/:id
(CITTAA_SUPER_ADMIN only)
```json
{ "reason": "Data deletion request" }
```
Response: 200 + { session deleted }

---

## Employee Endpoints

### GET /employees
Query params: page, limit, search, status
Response: 200 + { employees[], pagination }

### POST /employees
```json
{
  "email": "emp@company.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "department": "Engineering"
}
```
Response: 201 + { employee created, welcome email sent }

### GET /employees/:id
Response: 200 + { employee, stats }

### PUT /employees/:id
```json
{
  "firstName": "Jane(optional)",
  "lastName": "Smith(optional)",
  "department": "Product(optional)",
  "email": "new@company.com(optional)"
}
```
Response: 200 + { employee updated }

### DELETE /employees/:id
```json
{ "reason": "Resigned from company" }
```
Response: 200 + { employee offboarded }

### GET /employees/:id/sessions
Query params: page, limit
Response: 200 + { sessions[], pagination }

### POST /employees/bulk-import
Multipart form data:
- csv: [CSV file with headers: email, firstName, lastName, department]

Response: 201 + { batchId, message }

### GET /employees/import/:batchId
Response: 200 + { status, progress, result }

### POST /employees/:id/invite
```json
{ "scheduledAt": "2026-03-26T14:00:00Z(optional)" }
```
Response: 200 + { invitation sent }

### POST /employees/:id/schedule
```json
{
  "frequency": "weekly|monthly|quarterly",
  "nextAssessmentDate": "2026-04-01"
}
```
Response: 200 + { schedule updated }

---

## Alert Endpoints

### GET /alerts
Query params: page, limit, status, alertLevel
Response: 200 + { alerts[], pagination }

### GET /alerts/:id
Response: 200 + { alert }

### PUT /alerts/:id/acknowledge
```json
{ "note": "Acknowledged and will follow up(optional)" }
```
Response: 200 + { alert acknowledged }

### PUT /alerts/:id/escalate
```json
{
  "escalatedTo": "632f...",
  "reason": "Employee requires immediate intervention"
}
```
Response: 200 + { alert escalated, notification email sent }

### PUT /alerts/:id/resolve
```json
{ "resolutionSummary": "Employee completed counseling session..." }
```
Response: 200 + { alert resolved }

### GET /alerts/stats
Response: 200 + { stats: { byStatus, byLevel } }

---

## Analytics Endpoints

### GET /analytics/overview
Response: 200 + { overview: { totalSessions, activeAlerts, ... } }

### GET /analytics/trends
Query params: period (week|month|quarter)
Response: 200 + { trends[], period, daysBack }

### GET /analytics/departments
Response: 200 + { departments[] }

### GET /analytics/platform
(CITTAA_SUPER_ADMIN only)
Response: 200 + { stats: { tenants, users, sessions, topTenants } }

### GET /analytics/export
Query params: format (csv|json)
Response: 200 CSV download or JSON data

---

## Tenant Endpoints
(CITTAA_SUPER_ADMIN only)

### GET /tenants
Query params: page, limit, status
Response: 200 + { tenants[], pagination }

### POST /tenants
```json
{
  "name": "ACME Corporation",
  "industry": "Technology",
  "website": "https://acme.com",
  "monthlyAssessmentQuota": 500,
  "adminEmail": "admin@acme.com",
  "adminFirstName": "Alice",
  "adminLastName": "Johnson",
  "googleConfig": {
    "autoCreateMeetLinks": true
  }
}
```
Response: 201 + { tenant created, admin created, welcome email sent }

### GET /tenants/:id
Response: 200 + { tenant, stats }

### PUT /tenants/:id
```json
{
  "name": "New Name(optional)",
  "monthlyAssessmentQuota": 1000,
  "googleConfig": {...},
  "status": "active|suspended"
}
```
Response: 200 + { tenant updated }

### POST /tenants/:id/suspend
```json
{ "reason": "Billing overdue" }
```
Response: 200 + { tenant suspended }

### POST /tenants/:id/activate
Response: 200 + { tenant activated }

### DELETE /tenants/:id
```json
{ "reason": "Company dissolved" }
```
Response: 200 + { tenant deleted }

### POST /tenants/:id/impersonate
Response: 200 + { impersonationToken, admin }

---

## Health Check Endpoints

### GET /health
Response: 200 + { status: "ok", timestamp }

### GET /health/detailed
(Requires authentication)
Response: 200 + { status, user, timestamp }

---

## Common Request Headers

```
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Request-ID: <uuid> (optional, auto-generated)
```

## Common Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Rate Limited |
| 500 | Server Error |

## Error Response Format

```json
{
  "error": "Error message",
  "path": "/consultations/123",
  "method": "GET",
  "requestId": "uuid-here"
}
```

## Authentication Tokens

**Access Token:**
- Duration: 15 minutes
- Location: Response body
- Storage: Frontend (localStorage/state)
- Used for: API requests in Authorization header

**Refresh Token:**
- Duration: 7 days
- Location: HttpOnly cookie
- Storage: Browser cookie (automatic)
- Used for: Obtain new access token via POST /auth/refresh

## Rate Limiting

Login attempts: max 5 attempts
- After 5 failed attempts: 15-minute lockout
- Successful login: resets counter

## Bulk Import CSV Format

```
email,firstName,lastName,department
emp1@company.com,John,Doe,Engineering
emp2@company.com,Jane,Smith,Product
emp3@company.com,Bob,Johnson,Sales
```

## Pagination

All list endpoints support:
- `page`: 1-indexed (default: 1)
- `limit`: items per page (default: 20, max: 100)

Response includes:
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "pages": 8
  }
}
```

## Role Hierarchy

1. **CITTAA_SUPER_ADMIN** - Platform administrator
   - Access: All endpoints
   - Can: Create tenants, manage all data, impersonate users

2. **COMPANY_ADMIN** - Organization administrator
   - Access: Tenant-scoped
   - Can: Manage employees, create consultations, view analytics

3. **HR_ADMIN** - HR manager
   - Access: Tenant-scoped
   - Can: Manage employees, view alerts, manage consultations

4. **CLINICIAN** - Health professional
   - Access: Assigned consultations + sessions
   - Can: Complete consultations, view sessions, create assessments

5. **EMPLOYEE** - End user
   - Access: Own data only
   - Can: View wellness results, book consultations

---

## Example Workflow: Complete Assessment

```
1. Employee logs in
   POST /auth/login → { accessToken, refreshToken }

2. Employee submits audio
   POST /sessions with audio file
   → { sessionId, status: "processing" }

3. Poll for completion (or wait for webhook)
   GET /sessions/:id
   → { status: "completed", vocacoreResults, employeeWellnessOutput }

4. HR creates consultation
   POST /consultations { employeeId, clinicianId, ... }
   → { consultation, googleMeetLink sent, calendar invites sent }

5. Clinician completes consultation
   POST /consultations/:id/complete { clinicianNotes }
   → { consultation.status: "completed" }

6. Clinician finalizes session + generates report
   PUT /sessions/:id/finalise { clinicianNotes }
   → { reportGenerated: true }

7. Download report
   GET /sessions/:id/report
   → PDF binary download

8. HR reviews analytics
   GET /analytics/overview
   → { totalSessions, activeAlerts, avgScore, ... }
```
