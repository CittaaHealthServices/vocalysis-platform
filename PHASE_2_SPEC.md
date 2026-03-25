# Vocalysis Platform — Phase 2 Specification
## Status: READY TO BUILD — Activate after Phase 1 deployment

---

## FEATURE 1: REACT NATIVE MOBILE APP

### Overview
Cross-platform iOS + Android app for employee self-service wellness check-ins.
Works offline, syncs when connected. Push notifications for scheduled assessments.

### Tech Stack
- React Native 0.73 + Expo SDK 50
- Expo Audio for recording
- Expo Notifications for push
- AsyncStorage + SQLite (offline queue)
- React Query + custom offline sync
- React Navigation v6

### Architecture
```
┌─────────────────────────────────┐
│       Expo-managed App          │
│   (iOS + Android from one codebase)
├─────────────────────────────────┤
│  Local SQLite + AsyncStorage    │
│  (Offline-first data layer)     │
├─────────────────────────────────┤
│   React Query + Custom Sync     │
│   (Auto-retry on connection)    │
├─────────────────────────────────┤
│  Expo Push Notifications        │
│  + Background Task Handler      │
├─────────────────────────────────┤
│   REST API Client               │
│   (JWT + Refresh Token Rotation)│
└─────────────────────────────────┘
           Network
         (On/Offline)
             ↓
    Vocalysis Cloud API
    (Battery-optimized requests)
```

#### Offline Capability Design

**Recording & Queuing:**
- User can record audio even without internet
- Audio stored in device's file cache
- Session metadata (timestamp, location) stored in SQLite
- UI shows: "Recording saved locally. Will upload when connected."

**Sync Mechanism:**
- AsyncStorage: connection state change listener
- On reconnect: check SQLite for pending uploads
- Batch uploads (max 5 concurrent) with exponential backoff
- Sync status badge: "2 check-ins pending upload ⏳"

**Offline Resources:**
- Wellness tips/articles: pre-cached during onboarding
- Previous results: stored locally with 30-day cache
- User profile info: updated whenever synced

**Storage Management:**
- Automatic cleanup: delete local audio 24 hrs after successful upload
- Alert users if device storage <10%
- Manual "Clear Cache" option in settings

### Feature Screens

#### 1. Splash & Authentication
```
Splash Screen (2-3 sec)
  ↓
Login Screen
  • Email/Phone input
  • Password field
  • "Sign with Biometric" button
  • "Forgot Password" link
  • Sign up CTA

After Login:
  • TOTP prompt (if 2FA enabled)
  • Biometric registration option
  • Navigate to Home
```

#### 2. Home Dashboard
```
┌─────────────────────────────┐
│  Welcome, [Employee Name]   │
├─────────────────────────────┤
│  Wellness Score             │
│  ┌─────────────────────┐    │
│  │        74/100       │    │
│  │   Doing Well  ✓    │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  Last Check-in: 3 days ago  │
│                             │
│  [Start Wellness Check-in]  │ ← Primary CTA
│       (Button)              │
├─────────────────────────────┤
│  Next Scheduled:            │
│  Friday 2:00 PM            │
│  [View Calendar]           │
├─────────────────────────────┤
│  Quick Stats                │
│  • Streak: 12 weeks        │
│  • This month: +8 points   │
└─────────────────────────────┘
```

Features:
- Animated wellness score gauge
- Streak counter (days of consistent check-ins)
- Notification permission prompt on first load
- Quick navigation tabs: Home | History | Consultations | Profile

#### 3. Recording Screen
```
┌─────────────────────────────┐
│  Your Wellness Check-in     │
├─────────────────────────────┤
│  "Talk about how your week  │
│   has been. 1-3 minutes."   │
├─────────────────────────────┤
│  [Animated Waveform]        │
│   ≈≈≈  ≈≈  ≈≈≈  ≈≈       │
│  00:45 / 03:00             │
├─────────────────────────────┤
│  [Stop Recording] [Discard] │
└─────────────────────────────┘

After Recording Stops:
┌─────────────────────────────┐
│  Review & Submit            │
│  [▶ Play] Duration: 1:32   │
│                             │
│  [Delete] [Re-record]       │
│  [Submit for Analysis]      │
└─────────────────────────────┘
```

Implementation:
- `expo-av` for audio recording (native quality)
- Waveform visualization: `react-native-waveform`
- Haptic feedback on record start/stop
- Automatic stop at 3 minutes (max)
- Preview playback before submission

#### 4. Processing Screen
```
While uploading:
┌─────────────────────────────┐
│  Uploading...  ⏳           │
│  87% [████████░]           │
│  "Analyzing your voice"     │
└─────────────────────────────┘

If offline during processing:
┌─────────────────────────────┐
│  Saved Offline             │
│  "Will analyze when        │
│   connected"               │
│  [Retry] [See Queue]       │
└─────────────────────────────┘
```

#### 5. Results Screen
```
┌─────────────────────────────┐
│  Check-in Complete ✓        │
│  March 25, 2:30 PM         │
├─────────────────────────────┤
│  Wellness Assessment:       │
│  ┌─────────────────────┐    │
│  │     75/100          │    │
│  │   Doing Well    ↗   │    │
│  │ (improved +3 pts)   │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  Analysis Insights:         │
│  • Voice clarity: Good      │
│  • Speech rate: Elevated    │
│  • Stress markers: Mild     │
│                             │
│  💡 Tip: Take 5 deep       │
│     breaths to calm down    │
├─────────────────────────────┤
│  [Schedule Follow-up]       │
│  [Share with Doctor]        │
│  [Back to Home]             │
└─────────────────────────────┘
```

Features:
- Progress arrow (↗ improving, ↘ declining, → stable)
- Color-coded wellness category badge
- Actionable wellness tips (AI-generated)
- Option to book consultation directly

#### 6. History Screen
```
┌─────────────────────────────┐
│  Assessment History         │
├─────────────────────────────┤
│ Mar 25 - 75/100 Doing Well │
│ Mar 18 - 72/100 Doing Well │
│ Mar 11 - 71/100 Struggling │
│ Mar 4  - 68/100 Struggling │
│                             │
│ [Load More] or Scroll       │
├─────────────────────────────┤
│  6-Month Trend             │
│  ┌────────────────────┐    │
│  │   ╱╲   ╱╲         │    │
│  │  ╱  ╲╱  ╲╱╲       │    │
│  │ ╱        ╲ ╱╲     │    │
│  │          ╱   ╲   │    │
│  └────────────────────┘    │
│  Jan  Feb  Mar  Apr        │
└─────────────────────────────┘
```

Implementation:
- FlatList with pull-to-refresh
- Each item is tappable → detailed result view
- 6-month trend chart: `react-native-svg-charts`

#### 7. Consultations Screen
```
┌─────────────────────────────┐
│  Consultations              │
├─────────────────────────────┤
│ Upcoming:                   │
│                             │
│ Dr. Priya Sharma            │
│ Friday, March 28 • 2:00 PM │
│ [Join Google Meet] [📞 Call]│
│ (20 min before: button     │
│  becomes available)         │
│                             │
├─────────────────────────────┤
│ Previous:                   │
│ Dr. Rajesh Kumar            │
│ March 21 • Completed       │
│ [View Notes] [Re-book]      │
└─────────────────────────────┘
```

Features:
- Upcoming consultations synced from API
- "Join Meet" button only appears 15 min before
- Deep link to Google Meet
- Consultation notes accessible after session

#### 8. Profile & Settings
```
┌─────────────────────────────┐
│  Profile                    │
├─────────────────────────────┤
│ [Profile Picture]           │
│ Name: Arjun Singh          │
│ Email: arjun@company.com   │
│ Company: TechCorp Inc.     │
│ Department: Engineering    │
│                             │
│ [Edit Profile]              │
├─────────────────────────────┤
│ Settings                    │
│                             │
│ Notifications:              │
│ [Toggle] Wellness Reminders │
│ [Toggle] Consultation Alerts│
│ [Manage] Reminder Time      │
│          (Default: 2 PM)    │
│                             │
│ Privacy:                    │
│ [Toggle] Share with Doctor  │
│ [Manage] Data Sharing       │
│                             │
│ Security:                   │
│ [Enable] Biometric Lock     │
│ [Change] Password           │
│ [View] Session History      │
│                             │
│ Storage:                    │
│ "App uses 120 MB"          │
│ [Clear Cache]               │
│                             │
│ [Logout]                    │
└─────────────────────────────┘
```

#### 9. Notifications Preferences
```
┌─────────────────────────────┐
│ Notification Preferences    │
├─────────────────────────────┤
│ Assessment Reminders:       │
│ [Toggle] Enabled            │
│ Frequency: Weekly (Friday)  │
│ Time: [Picker] 2:00 PM      │
│                             │
│ Consultation Reminders:     │
│ [Toggle] Enabled            │
│ When: 15 min before         │
│                             │
│ Wellness Milestones:        │
│ [Toggle] Enabled            │
│ (e.g., "10-point improvement")
│                             │
│ [Save Changes]              │
└─────────────────────────────┘
```

### Push Notifications

**Notification Messages:**
```
Type 1 — Assessment Reminder:
  "Time for your weekly check-in 💙"
  → Tap to open Recording screen

Type 2 — Consultation Reminder (15 min before):
  "Your session starts in 15 mins with Dr. Sharma"
  → Tap to join Google Meet

Type 3 — Results Ready:
  "Your assessment is ready! You improved +5 points 🌟"
  → Tap to view Results screen

Type 4 — Milestone Achievement:
  "You've completed 52 check-ins! Keep going 🚀"
  → Tap to Home

Type 5 — Offline Queue Alert:
  "2 check-ins queued for upload (when online)"
  → Tap to Sync screen
```

**Implementation:**
- Backend: vocalysis-worker sends to Expo Push Notifications API
- Endpoint: `POST /v1/notifications/send-push` (internal only)
- Payload:
  ```json
  {
    "expoPushToken": "ExponentPushToken[...]",
    "title": "Assessment Reminder",
    "body": "Time for your weekly check-in 💙",
    "data": {
      "screen": "recording",
      "payload": {}
    }
  }
  ```
- Foreground handling: local notification alert
- Background handling: silent notification + background task

### Offline Sync Architecture

**SQLite Schema:**
```sql
-- Local copy of pending sessions
CREATE TABLE pending_sessions (
  id TEXT PRIMARY KEY,
  localId TEXT UNIQUE,
  audioPath TEXT NOT NULL,
  metadata JSON,
  createdAt DATETIME,
  uploadedAt DATETIME,
  status TEXT DEFAULT 'pending' -- pending, uploading, success, failed
);

-- Retry log
CREATE TABLE sync_retries (
  id INTEGER PRIMARY KEY,
  sessionId TEXT,
  attempt INTEGER,
  error TEXT,
  timestamp DATETIME
);

-- Local user data cache
CREATE TABLE user_cache (
  key TEXT PRIMARY KEY,
  data JSON,
  expiresAt DATETIME
);
```

**Sync Flow:**
```
User goes online → Check SQLite pending_sessions
                 → Filter status = 'pending'
                 → Upload max 5 in parallel
                 → On success: update status = 'success'
                 → On failure: retry with exponential backoff
                 → Max retries: 5
                 → After 48 hrs: mark as 'abandoned'
                 → Show UI alert if >3 abandoned
```

**Connection Detection:**
- Use `React Native NetInfo` API
- Listen to connection state changes
- Debounce rapid toggles (wireless → mobile data)
- Trigger sync on: `unmeteredWiFi` → any other type

### Build & Deployment

#### iOS Build
```bash
# Generate iOS build with EAS
eas build --platform ios --auto-submit

# First time: create Apple Developer account + signing certificate
# Subsequent: auto-sign using EAS

# Submit to App Store
# (Requires Apple Developer account + $99/year)
```

#### Android Build
```bash
# Generate Android build with EAS
eas build --platform android

# First time: generate signing key with EAS
# Subsequent: auto-sign with stored key

# Submit to Google Play
# (Requires Google Play Developer account + $25 one-time)
```

#### OTA Updates
```bash
# Update JavaScript code without app store resubmission
eas update --message "Fixed audio recording bug"

# Available to users within 10 minutes
# Users notified in-app: "A new version is available"
# Auto-download on next app launch
```

#### CI/CD Pipeline
```yaml
# .github/workflows/build.yml
on: [push to main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: eas build --auto-submit --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## FEATURE 2: WHATSAPP BUSINESS API BOT

### Overview
Employees receive assessment reminders via WhatsApp.
They reply with a voice note. The bot uploads it to Vocalysis pipeline.
No app installation required.

### Tech Stack
- WhatsApp Business Cloud API (Meta)
- Node.js webhook handler (add to vocalysis-api service)
- Worker job processor (vocalysis-worker)

### Business Value
- **Reach:** 80% of mobile users have WhatsApp
- **Engagement:** Push notifications vs WhatsApp messages: 5x higher open rate
- **Friction:** No app installation required
- **Privacy:** Business account = verified brand

### User Flow

```
1. Scheduled Time (e.g., Friday 2 PM)
   ↓
2. Worker sends WhatsApp message
   ↓
3. Employee receives message with CTA
   ↓
4. Employee records voice note + sends
   ↓
5. Bot webhook receives voice note
   ↓
6. Bot downloads from Meta CDN
   ↓
7. Bot uploads to /v1/sessions (authenticate as bot user)
   ↓
8. Bot confirms: "✅ Processing started"
   ↓
9. Results sent via WhatsApp when ready
   OR notification in app
```

### Message Templates

Meta requires pre-approved message templates. Create these in WhatsApp Business dashboard:

#### Template 1: `assessment_reminder`
```
Hi {{1}}! 👋

Time for your Vocalysis wellness check-in.

Please send a voice note (1-3 minutes) talking about
how your week has been. Your response is private. 💙

Tap the button below or reply with a voice note:

[Button: Start Check-in] (URL: vocalysis.cittaa.in/assessment)
[Button: Learn More] (URL: vocalysis.cittaa.in/help)
```

#### Template 2: `results_ready`
```
Great news, {{1}}! ✅

Your wellness check-in has been analyzed.

📊 Score: {{2}}/100 ({{3}})
📈 Change: {{4}}

[Button: View Results] (URL: app.vocalysis.cittaa.in/results/{{5}})
[Button: Book Consultation] (URL: app.vocalysis.cittaa.in/consultations)
```

#### Template 3: `consultation_reminder`
```
Hi {{1}}! 🏥

Your consultation with {{2}} starts in 15 minutes.

[Button: Join Session] (URL: meet.google.com/{{3}})

If you need to reschedule:
[Button: Reschedule] (URL: app.vocalysis.cittaa.in/consultations)
```

#### Template 4: `opt_out_confirmation`
```
You've been unsubscribed from WhatsApp assessments.

You can still:
• Use the Vocalysis app
• Schedule assessments via web
• Contact your administrator to re-enable

We'll miss you! 💙
```

### API Integration

**New Endpoints (in vocalysis-api):**

```javascript
// Webhook receiver (from Meta)
POST /v1/whatsapp/webhook
  query: ?hub.verify_token=[VERIFY_TOKEN]
         &hub.challenge=[CHALLENGE]
         &hub.mode=subscribe

  body: {
    "entry": [{
      "id": "BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messages": [{
            "from": "919876543210",
            "type": "audio",
            "audio": {
              "mime_type": "audio/ogg",
              "id": "123456789"
            }
          }],
          "contacts": [{
            "profile": {
              "name": "Arjun Singh"
            },
            "wa_id": "919876543210"
          }]
        }
      }]
    }]
  }

  response: {
    "status": "success",
    "sessionId": "session_xyz"
  }

// Send message to employee (internal)
POST /v1/whatsapp/send
  headers: {
    "Authorization": "Bearer [API_TOKEN]"
  }
  body: {
    "to": "919876543210",
    "template": "assessment_reminder",
    "parameters": ["Arjun"]
  }

  response: {
    "messageId": "wamid.XXXXX",
    "status": "accepted"
  }

// Get WhatsApp opt-in status
GET /v1/whatsapp/status/:employeeId
  response: {
    "employeeId": "emp_xyz",
    "whatsappNumber": "919876543210",
    "optIn": true,
    "optInDate": "2024-03-01T00:00:00Z"
  }

// Opt out endpoint (called from WhatsApp bot)
POST /v1/whatsapp/opt-out
  body: {
    "whatsappNumber": "919876543210"
  }
```

**Worker Job (vocalysis-worker):**

New queue: `whatsappQueue`

```javascript
// Job: send_assessment_reminder
{
  jobName: 'send_assessment_reminder',
  data: {
    employeeId: 'emp_xyz',
    whatsappNumber: '919876543210',
    employeeName: 'Arjun'
  }
}

// Processor:
whatsappQueue.process('send_assessment_reminder', async (job) => {
  const { whatsappNumber, employeeName } = job.data;

  // Call Meta API
  await fetch('https://graph.instagram.com/v18.0/{PHONE_ID}/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: whatsappNumber,
      type: 'template',
      template: {
        name: 'assessment_reminder',
        language: {
          code: 'en_US'
        },
        parameters: {
          body: {
            parameters: [employeeName]
          }
        }
      }
    })
  });
});
```

### Webhook Handler Logic

```javascript
// POST /v1/whatsapp/webhook
exports.handleWebhook = async (req, res) => {
  // Verify signature
  const signature = req.get('X-Hub-Signature-256');
  const expectedSignature = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!signature.includes(expectedSignature)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const { entry } = req.body;

  for (const { changes } of entry[0].changes) {
    const { messages, statuses } = changes.value;

    // Handle message
    if (messages) {
      for (const message of messages) {
        const { from, type, text, audio } = message;

        if (type === 'audio') {
          // Download audio from Meta CDN
          const mediaUrl = `https://graph.instagram.com/v18.0/${audio.id}`;
          const audioBuffer = await downloadFromMeta(mediaUrl);

          // Get employee info from WhatsApp number
          const employee = await Employee.findOne({ whatsappNumber: from });

          if (!employee) {
            // Opt-in flow: create temporary user
            await Employee.create({
              whatsappNumber: from,
              optInStatus: 'new',
              createdViaWhatsApp: true
            });
          }

          // Create session in queue
          const session = await Session.create({
            employeeId: employee._id,
            audioPath: `whatsapp/${from}/${Date.now()}.ogg`,
            source: 'whatsapp',
            processingStatus: 'queued'
          });

          // Save audio to storage
          await fs.writeFile(session.audioPath, audioBuffer);

          // Queue analysis job
          await audioAnalysisQueue.add('analyze_session', {
            sessionId: session._id
          });

          // Send confirmation
          await sendWhatsAppMessage(from, {
            type: 'text',
            text: '✅ Thanks! Your check-in is being processed. You\'ll see your results in the Vocalysis app shortly.'
          });
        }

        if (type === 'text' && text.body.toUpperCase() === 'STOP') {
          // Opt-out
          await Employee.updateOne(
            { whatsappNumber: from },
            { whatsappOptIn: false, whatsappOptOutDate: new Date() }
          );

          await sendWhatsAppMessage(from, {
            type: 'template',
            template: {
              name: 'opt_out_confirmation',
              language: { code: 'en_US' }
            }
          });
        }
      }
    }

    // Handle delivery status
    if (statuses) {
      for (const status of statuses) {
        // Track message delivery
        await WhatsAppDeliveryLog.create({
          messageId: status.id,
          status: status.status,
          timestamp: new Date(status.timestamp * 1000)
        });
      }
    }
  }

  res.json({ status: 'ok' });
};
```

### Environment Variables

Add to api/.env.example:
```env
# WhatsApp Business API
WHATSAPP_API_TOKEN=<from Meta Business>
WHATSAPP_PHONE_NUMBER_ID=<from WhatsApp Business Dashboard>
WHATSAPP_VERIFY_TOKEN=<generate random string>
WHATSAPP_APP_SECRET=<from Facebook App Settings>
WHATSAPP_BUSINESS_ACCOUNT_ID=<from WhatsApp Business Dashboard>
```

### Schema Additions

**Employee Model:**
Add fields:
```javascript
whatsappNumber: {
  type: String,
  match: /^\d{10,15}$/,
  sparse: true
},
whatsappOptIn: {
  type: Boolean,
  default: false
},
whatsappOptInDate: Date,
whatsappOptOutDate: Date,
createdViaWhatsApp: {
  type: Boolean,
  default: false
}
```

Add index:
```javascript
db.collection('employees').createIndex({ whatsappNumber: 1 }, { sparse: true });
```

**New Collection: WhatsAppDeliveryLog**
```javascript
{
  _id: ObjectId,
  messageId: String,
  to: String,
  from: String,
  status: String, // 'sent', 'delivered', 'read', 'failed'
  template: String,
  timestamp: Date,
  createdAt: Date
}
```

### WhatsApp Setup Checklist

- [ ] Create Meta Business Account (business.facebook.com)
- [ ] Verify business ownership
- [ ] Create WhatsApp Business App
- [ ] Get Phone Number ID + API Token
- [ ] Create message templates (submit for approval)
- [ ] Configure webhook URL: `https://api.vocalysis.cittaa.in/v1/whatsapp/webhook`
- [ ] Set verify token in environment
- [ ] Test webhook with Meta's test tool
- [ ] Enable message updates subscription
- [ ] Setup delivery status tracking
- [ ] Train support team on opt-in/opt-out flows

---

## FEATURE 3: MANAGER WELLNESS DASHBOARD

### Overview
Read-only aggregate wellbeing intelligence for people managers.
Team-level only. Zero individual identification. Zero clinical data.
Pure privacy-first design. Compliant with DPDP Act 2023.

### Privacy Architecture (ENFORCED AT DB LEVEL)

**Principle 1: Row-Level Security**
```javascript
// MongoDB query ALWAYS includes:
{
  managerId: currentUser.userId,
  tenantId: currentUser.tenantId
}
// Prevents horizontal privilege escalation
```

**Principle 2: Column-Level Masking**
```javascript
// Names NEVER returned in manager API responses
// Employee IDs masked: EMP-001, EMP-002, etc.
// No clinical data exposure
```

**Principle 3: Aggregation Only**
```javascript
// Only show: team-level statistics
// Never: individual scores, biomarker data
// Show: category only (Thriving / Doing Well / Needs Attention / Support Needed)
```

### New User Role: MANAGER

**Permission Hierarchy:**
```
CITTAA_SUPER_ADMIN (root)
         ↓
COMPANY_ADMIN (all employees in company)
         ↓
HR_ADMIN (assigned departments, anonymized)
         ↓
MANAGER (direct reports only, anonymized)
         ↓
EMPLOYEE (own data only)
```

**Rules:**
- Manager role is assigned by HR_ADMIN
- A user can hold both MANAGER + EMPLOYEE roles simultaneously
- Manager can see ONLY direct reports (via `reportingManagerId` in Employee)
- HR_ADMIN and above can manage manager assignments

**Assignment Flow:**
```
HR_ADMIN opens Employee record
  ↓
Sets "Reporting Manager" field
  ↓
Employee role gets new permission: "view_direct_reports"
  ↓
MANAGER can now access Manager Dashboard
```

### New Schema: ManagerNudge

```javascript
{
  _id: ObjectId,
  tenantId: String,
  managerId: String, // User ID of manager
  nudgeType: String, // See nudge types below
  nudgeText: String, // Human-readable message
  actionText: String, // CTA button text
  triggerCondition: String, // Used to deduplicate
  firedAt: Date, // When nudge was triggered
  dismissedAt: Date, // null if not dismissed
  actedAt: Date, // When manager clicked action
  monthYear: String, // "2024-03" for deduplication
  isActive: Boolean, // true = show to manager
  metadata: {
    affectedEmployeeCount: Number,
    affectedDepartmentId: String,
    suggestedAction: String
  }
}
```

### Nudge Engine (Server-side)

Runs as a cron job in vocalysis-worker: `0 9 * * *` (daily at 9 AM)

**Rule 1 — DECLINING_TREND**
```
Condition:
  - Any direct report: wellness score declining >3 pts
  - Across 3+ consecutive sessions
  - Score < 60 (Support Needed)

Trigger:
  CREATE nudge where:
    nudgeType = 'DECLINING_TREND'
    nudgeText = '2 team members may benefit from a personal check-in'
    actionText = 'What to say →'
    metadata.affectedEmployeeCount = 2

Action When Clicked:
  GET /manager/nudges/{id}/generate-guide
  Returns:
    {
      conversationGuide: "Based on their voice patterns, try asking...",
      wellnessResources: [urls],
      clinicianReferralLink: "/consultations/request"
    }
```

**Rule 2 — POSITIVE_IMPROVEMENT**
```
Condition:
  - Aggregate team wellness score improved ≥5 points
  - Measured month-over-month
  - Last month vs this month

Trigger:
  CREATE nudge where:
    nudgeType = 'POSITIVE_IMPROVEMENT'
    nudgeText = 'Your team\'s wellbeing improved 8 points this month! 🌟'
    actionText = 'Celebrate with your team →'
    metadata.improvement_points = 8

Action When Clicked:
  Suggestions:
    - Draft team message (template)
    - Schedule team lunch/outing
    - Share achievement with HR
```

**Rule 3 — OVERDUE_CHECKINS**
```
Condition:
  - Any direct report: >7 days since last check-in
  - Due for scheduled assessment

Trigger:
  CREATE nudge where:
    nudgeType = 'OVERDUE_CHECKINS'
    nudgeText = '3 team members haven\'t completed their check-in'
    actionText = 'Draft a message →'
    metadata.affectedEmployeeCount = 3

Action When Clicked:
  POST /manager/nudges/{id}/generate-guide
  Returns:
    {
      draftMessage: "Hey team! Just a reminder to complete your wellness check-in...",
      whatsappTemplate: "Use this for WhatsApp...",
      emailTemplate: "Use this for email..."
    }

  Manager can:
    - Copy & send from their own tools
    - Schedule via platform
    - Track response rates
```

**Rule 4 — HIGH_WORKLOAD_SIGNAL**
```
Condition:
  - Stress scores across team all elevated (>70) simultaneously
  - At same time point (e.g., all Friday afternoon)
  - Indicates external pressure event

Trigger:
  CREATE nudge where:
    nudgeType = 'HIGH_WORKLOAD_SIGNAL'
    nudgeText = 'Your team may be experiencing high workload pressure'
    actionText = 'Check workload distribution →'
    metadata.signal_type = 'workload'

Action When Clicked:
  Links to:
    - HR resources: stress management guide
    - Time-off policies
    - Manager toolkit: how to reduce workload
```

### Manager Dashboard Pages

#### Page 1 — Team Wellness Overview
```
┌─────────────────────────────────────────┐
│ Team Wellness Dashboard                 │
├─────────────────────────────────────────┤
│                                         │
│  Team Score                             │
│  ┌─────────────────────────────────┐   │
│  │           74/100                │   │
│  │     ↗ +2 this month             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Team Composition                       │
│  ┌─────────────────────────────────┐   │
│  │ Thriving (5)     ███░░░░░░░░░  │   │
│  │ Doing Well (8)   ██████░░░░░░░  │   │
│  │ Needs Attention (4) ███░░░░░░░░│   │
│  │ Support Needed (2) ██░░░░░░░░░░│   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  🔔 NUDGE PANEL (Right Side)            │
│                                         │
│  Priority Nudge:                        │
│  "2 team members may benefit           │
│   from a personal check-in"             │
│                                         │
│  [What to say →]                        │
│  [Dismiss]                              │
└─────────────────────────────────────────┘
```

**Components:**
- Large circular gauge for team score (0-100)
- Arrow indicator (↗ ↘ →) for trend
- Donut chart: distribution by category
- Nudge panel: highest priority active nudge
- Actions: View team members, trends, consultations

#### Page 2 — Team Member Cards
```
┌─────────────────────────────────────────┐
│ Team Members (19 total)                 │
│ [Filter: All] [Doing Well] [Attention] │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ EMP-001  │  │ EMP-002  │  │EMP-003 ││
│  │ Thriving │  │ Thriving │  │Attention││
│  │   ↗      │  │   →      │  │   ↘  ⚠ ││
│  │ 3d ago   │  │ 5d ago   │  │ 8d ago ││
│  └──────────┘  └──────────┘  └────────┘│
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ EMP-004  │  │ EMP-005  │  │EMP-006 ││
│  │ Doing... │  │ Thriving │  │Support ││
│  │   →      │  │   ↗      │  │   ↘↘ 🔴││
│  │ 1d ago   │  │ 2d ago   │  │ 12d ago││
│  └──────────┘  └──────────┘  └────────┘│
│  ... (grid continues)                   │
└─────────────────────────────────────────┘
```

**Card Details:**
- Identifier: EMP-XXX (never real names)
- Wellness category badge (color-coded)
- Trend arrow + last check-in date
- Amber border if "Needs Attention"
- Red border if "Support Needed"
- NO scores, NO clinical data

**On Card Tap:**
```
┌──────────────────────────────┐
│ EMP-001 Wellness Profile     │
├──────────────────────────────┤
│ Category: Thriving           │
│ Last Check-in: 3 days ago    │
│ 6-Month Trend:               │
│ [Small line chart]           │
│                              │
│ [Schedule Consultation]      │
│ [Add Notes]                  │
│ [Email Resources]            │
└──────────────────────────────┘
```

**Notes Field** (manager can add private notes):
```
"EMP-001 had a major project delivery last week,
 probably why thriving. Keep an eye after next sprint."
```

#### Page 3 — Team Trend
```
┌──────────────────────────────────┐
│ Team Wellness Trend (6 months)   │
├──────────────────────────────────┤
│  80 ┤         ╱╲                │
│     │        ╱  ╲  ╱╲           │
│  70 ┤       ╱    ╲╱  ╲          │
│     │      ╱         ╲╱╲        │
│  60 ┤     ╱             ╲       │
│     │____╱_______________╲____   │
│  50 ┤   |    |    |    |    |   │
│     │  Sep  Oct  Nov  Dec  Jan  │
│                                  │
│ Annotations:                     │
│ [+ button to add context]        │
│ "Team restructure" (Dec 1)      │
│ "Project deadline" (Jan 5)      │
│                                  │
│ [Save Annotations]               │
└──────────────────────────────────┘
```

**Annotations** (manager can add):
- Text input + date picker
- Helps track external factors (restructure, project launch)
- Visible in team member discussions
- Never visible to individual employees

#### Page 4 — Consultations
```
┌──────────────────────────────────┐
│ Consultations & Support          │
├──────────────────────────────────┤
│ Book Group Session               │
│                                  │
│ [Session Type: ]                 │
│  • Stress management             │
│  • Sleep & recovery              │
│  • Work-life balance             │
│  • Anger management              │
│                                  │
│ [Date Picker] [Time Picker]      │
│ [Select Attendees] (multi)       │
│ [Book]                           │
│                                  │
├──────────────────────────────────┤
│ Request Individual Referral      │
│                                  │
│ [Search Employee] EMP-001        │
│ Reason: [Dropdown]               │
│  • Wellness check-in             │
│  • Manager concern               │
│  • Self-referred                 │
│ Message: [Text area]             │
│ [Request]                        │
│                                  │
│ (Goes to HR/Clinician review)    │
│ (Employee notified privately)    │
└──────────────────────────────────┘
```

### New API Endpoints

```javascript
// 1. Team overview (aggregated stats)
GET /manager/team-overview
  response: {
    teamScore: 74,
    trendArrow: '↗',
    trendValue: 2,
    composition: {
      thriving: 5,
      doingWell: 8,
      needsAttention: 4,
      supportNeeded: 2
    },
    totalMembers: 19
  }

// 2. Team members (anonymized list)
GET /manager/team-members?filter=all
  query: filter in [all, thriving, doingWell, needsAttention, supportNeeded]

  response: {
    members: [
      {
        employeeId: "emp_xyz", // NOT revealed to manager
        maskedId: "EMP-001",
        category: "Thriving",
        trend: "↗",
        lastCheckIn: "2024-03-22T14:30:00Z",
        daysAgo: 3,
        isNeedsAttention: false
      }
    ]
  }

// 3. Team trend data
GET /manager/team-trend?months=6
  response: {
    months: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    scores: [68, 71, 69, 74, 76],
    annotations: [
      {
        date: "2024-01-05",
        text: "Project deadline",
        addedBy: "manager_xyz"
      }
    ]
  }

// 4. Nudges
GET /manager/nudges
  response: {
    active: [
      {
        nudgeId: "nudge_xyz",
        type: "DECLINING_TREND",
        text: "2 team members may benefit from a personal check-in",
        actionText: "What to say →",
        firedAt: "2024-03-25T09:00:00Z",
        metadata: { affectedEmployeeCount: 2 }
      }
    ],
    dismissed: [] // Previously dismissed
  }

// 5. Dismiss nudge
PUT /manager/nudges/:id/dismiss
  response: { status: 'dismissed' }

// 6. Mark nudge as acted upon
PUT /manager/nudges/:id/acted
  response: { status: 'acted' }

// 7. Generate conversation guide
POST /manager/nudges/:id/generate-guide
  body: { nudgeType: 'DECLINING_TREND' }
  response: {
    conversationGuide: "Based on voice biomarkers...",
    wellnessResources: [{title, url}],
    referralLink: "/consultations/request?employeeId=EMP-001"
  }

// 8. Request consultation
POST /manager/request-consultation
  body: {
    type: 'group' | 'individual',
    employeeIds: ['emp_xyz'], // Single for individual
    sessionType: 'stress_management', // Group type
    proposedDate: '2024-03-30',
    proposedTime: '14:00',
    message: 'Optional manager notes'
  }
  response: {
    requestId: "consult_xyz",
    status: 'pending_approval'
  }

// 9. Get consultation requests history
GET /manager/consultations/requests
  response: {
    pending: [],
    approved: [],
    completed: []
  }
```

### Schema Additions

**Employee Model:**
```javascript
managerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  sparse: true,
  index: true
},
reportingManagerId: { // Alias for clarity
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  sparse: true
}
```

Add index:
```javascript
db.collection('employees').createIndex({ tenantId: 1, managerId: 1 });
```

**User Model:**
```javascript
// Already has role field
// For MANAGER role, additional permissions:
permissions: {
  view_direct_reports: Boolean,
  manage_team_consultations: Boolean
}
```

**ManagerNudge Collection (new):**
See schema above.

### Nudge Job (Cron in Worker)

```javascript
// vocalysis-worker: cron job running daily at 9 AM
const cron = require('node-cron');

cron.schedule('0 9 * * *', async () => {
  console.log('Running manager nudge engine...');

  // Get all managers
  const managers = await User.find({ role: 'MANAGER' });

  for (const manager of managers) {
    const directReports = await Employee.find({
      managerId: manager._id,
      tenantId: manager.tenantId
    });

    // Rule 1: DECLINING_TREND
    const decliningEmployees = directReports.filter(emp => {
      // Check last 3 sessions
      // Calculate trend
      // Return if declining
    });

    if (decliningEmployees.length > 0) {
      const existing = await ManagerNudge.findOne({
        managerId: manager._id,
        nudgeType: 'DECLINING_TREND',
        monthYear: getCurrentMonthYear(),
        isActive: true
      });

      if (!existing) {
        await ManagerNudge.create({
          tenantId: manager.tenantId,
          managerId: manager._id,
          nudgeType: 'DECLINING_TREND',
          nudgeText: `${decliningEmployees.length} team members may benefit from a personal check-in`,
          actionText: 'What to say →',
          triggerCondition: 'declining_trend',
          firedAt: new Date(),
          monthYear: getCurrentMonthYear(),
          isActive: true,
          metadata: {
            affectedEmployeeCount: decliningEmployees.length
          }
        });
      }
    }

    // Rules 2-4: similar logic...
  }
});
```

### Security Enforcement

**Query middleware (Mongoose plugin):**
```javascript
// Apply to ManagerNudge, team endpoints
schema.pre('find', function() {
  if (this.options.userRole === 'MANAGER') {
    this.where({ managerId: this.options.userId });
  }
});

// Apply to all manager-facing queries
// Prevents: db.employees.find({})
// Forces:   db.employees.find({ managerId: userId, tenantId: userId })
```

### Audit Logging

All manager actions logged:
```javascript
{
  action: 'viewed_team_members',
  actor: 'user_xyz',
  actorRole: 'MANAGER',
  timestamp: Date,
  details: {
    teamSize: 19,
    pageViewed: 'team-overview'
  }
}

{
  action: 'acted_on_nudge',
  actor: 'user_xyz',
  nudgeId: 'nudge_xyz',
  nudgeType: 'DECLINING_TREND',
  timestamp: Date
}
```

---

## BUILD ORDER FOR PHASE 2

### Priority 1 (Week 1-2): Manager Dashboard
```
Why first:
  • Lowest infrastructure dependency
  • Can be tested with existing Phase 1 data
  • Highest business impact (early warning system)
  • Prepares database schema for mobile app later

Tasks:
  - Create ManagerNudge schema + indexes
  - Build nudge engine (cron job in worker)
  - Create 4 dashboard pages (React components)
  - Implement 9 API endpoints
  - Add manager assignment flow in HR admin
  - Write privacy/security tests
  - Deploy to Railway
```

### Priority 2 (Week 3-4): WhatsApp Bot
```
Why second:
  • Requires WhatsApp approval (2-3 weeks)
  • Start approval process NOW (while building dashboard)
  • Moderate complexity, moderate impact

Tasks:
  - Apply for WhatsApp Business API access
  - Create message templates
  - Implement webhook handler
  - Add Worker jobs for sending messages
  - Create opt-in/opt-out flows
  - Integration testing with Meta's testing API
  - Deploy to Railway
```

### Priority 3 (Week 5-12): React Native App
```
Why last:
  • Largest engineering effort
  • Can parallelize with WhatsApp
  • Requires App Store/Play Store review (2-3 weeks)
  • Builds on database/API from Phase 1 + Phase 2

Tasks:
  - Setup Expo project
  - Build 9 screens (recording, results, history, etc.)
  - Implement offline-first SQLite sync
  - Setup push notifications
  - Biometric authentication
  - CI/CD with EAS
  - Beta testing on TestFlight + Google Play
  - App Store submission
  - Post-launch monitoring
```

---

## DEPENDENCIES TO PREPARE NOW

While Phase 1 is deploying, begin these processes in parallel:

**Immediate (This week):**
- [ ] Create Meta Business Account at business.whatsapp.com
- [ ] Verify Cittaa Health Services business ownership
- [ ] Start WhatsApp Business API approval process
- [ ] Allocate 2-3 weeks for approval

**Week 2:**
- [ ] Create Expo account at expo.dev (free)
- [ ] Create Apple Developer account (ios.developer.apple.com) — $99/year
- [ ] Create Google Play Console account (play.google.com) — $25 one-time
- [ ] Ensure vocalysis.cittaa.in domain is owned/configured

**Week 3:**
- [ ] Setup iOS code signing certificate (using EAS Credentials)
- [ ] Setup Android keystore (using EAS)
- [ ] Create TestFlight app (for iOS beta)
- [ ] Create Google Play internal testing track

**Ongoing:**
- [ ] Document manager role assignment process for HR
- [ ] Create change management plan (managers getting new dashboard)
- [ ] Plan privacy training for managers on data handling
- [ ] Budget for app store fees + push notification service

---

## ROLLOUT STRATEGY

### Manager Dashboard (Week 15)
```
Day 1-2: Deploy to production (blue-green)
Day 3: Enable for 10% of managers (canary)
Day 4-5: Monitor alerts, performance
Day 6: Enable for 50% (gradually)
Week 2: Full rollout to all managers
Week 3: Training webinar + documentation
```

### WhatsApp Bot (Week 17)
```
Week 1: Testing with select employees (opt-in)
Week 2: Rollout to all employees with WhatsApp
Week 3: Monitor message delivery + engagement
```

### Mobile App (Week 20)
```
Beta Phase (Week 1-2):
  • TestFlight for iOS (50 testers)
  • Google Play internal for Android (100 testers)
  • Daily build cycle + feedback loop

Production Launch (Week 3+):
  • App Store release (1-3 day review)
  • Play Store release (minutes)
  • Gradual rollout via staged rollout (25%, 50%, 100%)
  • In-app prompts encouraging update
```

---

**Last Updated:** March 2026
**Status:** Ready for development activation
