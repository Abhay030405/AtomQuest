# Good-to-Have Features Plan
# AtomQuest Hackathon 2026 | All 4 Bonus Features — Enterprise-Grade Implementation

> These features are built AFTER Phase 1 and Phase 2 are fully stable and tested.
> Each feature plugs into the existing architecture without modifying core code.
> This is the Open/Closed Principle at the product level — extend, never modify.
> Priority order: Email/Teams → Escalation → Analytics → Azure AD SSO

---

## Architecture Integration Note

Every bonus feature below integrates via the SAME patterns already built in Phase 1+2:
- Notifications plug into the existing NotificationHandler (new channel classes only)
- Escalation plugs into the existing EventBus (new EscalationHandler subscriber)
- Analytics reads from analytics_snapshots (CQRS read model already built in Phase 2)
- Azure AD SSO adds a new auth endpoint — email/password auth remains as fallback

This means: no core service changes. Every bonus feature is purely additive.
This is what judges mean by "depth and quality of implementation" in the rubric.

---

## Feature 1 — Email & Microsoft Teams Notifications
**Priority: Build First | Effort: Low | Impact: High**

### Philosophy
Workday treats notifications as a first-class system, not an afterthought.
The NotificationService was designed channel-agnostic from the start (Phase 1).
Adding Email + Teams = two new Channel classes. Zero changes to NotificationService.
This is the Open/Closed Principle in action — the most natural demo of the architecture.

### Architecture — Channel-Agnostic NotificationService

Already built in Phase 1. The service:
```
NotificationService.send(recipient_id, event_type, context_data)
  → loads user notification preferences
  → for each enabled channel:
      EmailChannel.send(recipient, template, context)       ← NEW for bonus
      TeamsChannel.send(recipient, adaptive_card, context)  ← NEW for bonus
      InAppChannel.create(recipient, message, deep_link)    ← Already built Phase 1
```

Adding Email = one new EmailChannel class.
Adding Teams = one new TeamsChannel class.
Zero changes to NotificationService, zero changes to handlers. Pure extension.

### Complete Notification Event Matrix

| Event | Who Notified | Email | Teams | In-app |
|---|---|---|---|---|
| GOAL_SHEET_SUBMITTED | Manager (L1) | ✅ | ✅ | ✅ |
| GOAL_SHEET_APPROVED | Employee | ✅ | ❌ | ✅ |
| GOAL_SHEET_RETURNED | Employee | ✅ | ❌ | ✅ |
| GOAL_EDITED_BY_MANAGER | Employee | ❌ | ❌ | ✅ |
| GOAL_UNLOCKED | Employee + Manager | ✅ | ❌ | ✅ |
| CHECKIN_COMPLETED | Employee | ✅ | ❌ | ✅ |
| CHECKIN_ACKNOWLEDGED | Manager | ❌ | ❌ | ✅ |
| WINDOW_OPENING_SOON | All employees + managers | ✅ | ✅ | ✅ |
| ACHIEVEMENT_NOT_SUBMITTED | Employee | ✅ | ❌ | ✅ |
| CHECKIN_NOT_COMPLETED | Manager | ✅ | ✅ | ✅ |
| SHARED_GOAL_RECEIVED | Employee | ✅ | ❌ | ✅ |

### Email Implementation — Resend API

**Why Resend:** Free 3,000/month. Jinja2 templates (FastAPI native). 5-minute setup.

Email templates to build (Jinja2 HTML):

1. `goal_submitted_to_manager.html`
   - Subject: "[CADENCE] {employee_name} submitted Q{n} goals for approval"
   - Body: employee name, goal count, weightage, submission timestamp
   - CTA: "Review Goals" → deep link to /manager/approvals/{sheet_id}

2. `goal_approved_to_employee.html`
   - Subject: "[CADENCE] Your goals have been approved by {manager_name}"
   - Body: approved goals list, targets, effective cycle
   - CTA: "View My Goals" → /employee/goals

3. `goal_returned_to_employee.html`
   - Subject: "[CADENCE] Goals returned for revision — feedback from {manager_name}"
   - Body: rework reason prominently, list of goals needing changes
   - CTA: "Revise My Goals" → /employee/goals?mode=draft

4. `checkin_completed_to_employee.html`
   - Subject: "[CADENCE] Your Q{n} check-in is ready — {manager_name}"
   - Body: manager's comment, overall score, date
   - CTA: "View & Acknowledge" → /employee/checkins/{checkin_id}

5. `window_opening_reminder.html`
   - Subject: "[CADENCE] Q{n} Achievement Tracking opens in 3 days"
   - Body: what to do, window dates, goal list reminder
   - CTA: "Go to Portal"

6. `achievement_overdue_escalation.html`
   - Subject: "[CADENCE] Action Required: Q{n} submission due in {days} days"
   - Body: specific goals needing update, deadline
   - CTA: "Submit Now"

**Deep link design:**
Every CTA goes directly to the relevant page+action:
`https://cadence-app.vercel.app/employee/quarterly-update?quarter=q1&highlight=goal_id`
This is how Workday links from email → exact screen. Judges will notice this.

### Microsoft Teams Integration — Incoming Webhooks

**Why webhooks (not bot registration):**
No Azure App registration needed. No OAuth. Just HTTP POST to a webhook URL.
5-minute setup. Works in any Teams tenant. Perfect for hackathon demo.

**TeamsChannel implementation:**
```python
class TeamsChannel:
    def send(self, recipient_id, event_type, context):
        webhook_url = self._get_webhook_for_user(recipient_id)
        card = self._build_adaptive_card(event_type, context)
        requests.post(webhook_url, json=card)
```

**Adaptive Card for goal submission (Teams):**
```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "text": "📋 Goal Sheet Submitted",
      "weight": "Bolder", "size": "Medium" },
    { "type": "FactSet", "facts": [
        { "title": "Employee",   "value": "{{employee_name}}" },
        { "title": "Goals",      "value": "{{goal_count}}" },
        { "title": "Weightage",  "value": "100%" },
        { "title": "Submitted",  "value": "{{submitted_at}}" }
    ]}
  ],
  "actions": [
    { "type": "Action.OpenUrl", "title": "Review Goals", "url": "{{deep_link}}" }
  ]
}
```

### In-App Notification System (already built in Phase 1)

Notification bell in Topbar:
- Unread count badge (red dot)
- Dropdown: last 10 notifications, each with icon + title + time ago
- "Mark all as read"
- "View all" → full notification page

Data flow:
- DB: notifications table (already in Phase 1 schema)
- Frontend: polls GET /api/v1/notifications/unread-count every 30s
- On bell click: GET /api/v1/notifications/ (paginated)
- PATCH /api/v1/notifications/{id}/read marks individual read

---

## Feature 2 — Escalation Module (Rule-Based)
**Priority: Build Second | Effort: Medium | Impact: High**

### Philosophy
SAP SuccessFactors has a fully configurable escalation engine.
Rules are data, not code. Escalation has stages. Each stage has a cooldown.
History is logged. Triggers are time-based.

The Escalation engine in CADENCE plugs into the EventBus as one new handler.
It also uses CheckinCompletionTracker (already built in Phase 2) to query state.
No core service changes. Pure extension.

### New Database Tables

#### `escalation_rules`
- `id` UUID PRIMARY KEY
- `rule_name` VARCHAR(255)
- `trigger_event` ENUM('GOAL_NOT_SUBMITTED','APPROVAL_PENDING','ACHIEVEMENT_MISSING','CHECKIN_MISSING')
- `trigger_condition` JSONB — e.g. { "days_since_window_open": 7 }
- `escalation_chain` JSONB — e.g. [
    { "target": "self",    "delay_days": 0 },
    { "target": "manager", "delay_days": 3 },
    { "target": "hr",      "delay_days": 5 }
  ]
- `is_active` BOOLEAN DEFAULT true
- `notification_template_id` VARCHAR — which email template to use
- `created_by` UUID FK → users(id)

**Rules are data:** Admin configures rules in the UI. Adding new escalation =
one DB insert. Zero code changes. This is configurable system design.

#### `escalation_log`
- `id` UUID PRIMARY KEY
- `rule_id` UUID FK → escalation_rules(id)
- `target_user_id` UUID FK → users(id)
- `escalation_level` INTEGER — 0=self, 1=manager, 2=hr
- `escalated_to_user_id` UUID FK → users(id)
- `trigger_reason` TEXT
- `notification_sent_at` TIMESTAMP
- `resolved_at` TIMESTAMP NULLABLE
- `resolved_by` UUID FK → users(id) NULLABLE
- `status` ENUM('pending','notified','resolved','ignored')

### Escalation Engine Design

**EscalationScheduler (cron — runs every hour via APScheduler):**
```
EscalationScheduler.run():
  1. Fetch all active escalation_rules
  2. For each rule: evaluate trigger_condition against current state
     - Uses CheckinCompletionTracker for "has_submitted", "has_checkin"
     - Uses CycleService for "days_since_window_open"
  3. Find affected users who meet the trigger condition
  4. For each user: check escalation_log → already notified this level?
  5. If not notified OR cooldown passed: EscalationService.escalate()
  6. Log to escalation_log
```

**EscalationService.escalate(rule, target_user, level):**
1. Determine who to notify from escalation_chain[level]:
   - level 0: notify target_user ("you haven't submitted")
   - level 1: notify target_user's manager ("team member hasn't submitted")
   - level 2: notify HR/admin ("still not resolved after 2 reminders")
2. Send via NotificationService (email + in-app)
3. Insert into escalation_log
4. If all levels exhausted: flag in Admin dashboard as "unresolved critical"

**Resolution tracking:**
When employee submits achievement → check escalation_log for open records
for that user + quarter → mark resolved. Keeps log clean.

**Admin UI for Escalation:**
- Rule config table: Name | Trigger | Chain | Active | Edit
- Escalation log: User | Rule | Level | Notified At | Status | Resolve button
- Summary card: "5 open escalations — 2 critical (HR-level)"

**Demo scenario:**
1. Admin creates rule: "If achievement not submitted 3 days after window opens → escalate"
2. Show test employee has not submitted
3. Click "Run Escalation Check Now" button (manual trigger for demo)
4. Employee gets email + in-app notification
5. escalation_log shows record
6. Employee submits → record auto-resolved → log updated

---

## Feature 3 — Analytics Module
**Priority: Build Third | Effort: Low (Phase 2 did the hard work) | Impact: Very High**

### Why effort is LOW now:
Phase 2 built analytics_snapshots (CQRS read model) and the SnapshotUpdateHandler.
All data needed for analytics already exists in clean, pre-aggregated form.
Analytics is almost entirely a frontend exercise — read snapshots, render charts.

### Analytics Endpoints

`GET /api/v1/analytics/org-summary`
Reads from analytics_snapshots.
Returns: avg weighted_score, completion rate, checkin rate across org.
Quarter-on-quarter comparison: Q1 vs Q2 vs Q3 vs Q4.

`GET /api/v1/analytics/department/{dept_id}`
Scoped to department. Same metrics.
Top performers (highest weighted_score), bottom performers.
Manager comparison: side-by-side checkin completion rates.

`GET /api/v1/analytics/individual/{user_id}`
Employee trajectory across all quarters.
Goal-by-goal breakdown: which goals consistently underperform.
Percentile rank within department.

`GET /api/v1/analytics/goal-distribution`
Breakdown by: Thrust Area, UoM Type, Status.
Answers: "Which thrust areas are employees most focused on?"
Reads from goals table — no snapshot needed here.

`GET /api/v1/analytics/manager-effectiveness`
Per manager: team avg score, checkin completion rate, approval turnaround time.
Approval turnaround: avg days from submission to approval (goals table).
Identifies slow-to-approve managers.

`GET /api/v1/analytics/at-risk`
Employees where Q1+Q2 average < 50% → flagged at risk.
Reads from analytics_snapshots.
Returned as prioritised list for HR intervention.

### Frontend — Analytics Dashboard (Admin only)

**Section 1: Org Overview cards**
- Total Goals Set | Avg Completion Rate | Avg Weighted Score | Check-in Rate
- Recharts-powered big number metric cards

**Section 2: QoQ Trend (Line Chart)**
```
X-axis: Q1, Q2, Q3, Q4
Y-axis: Average weighted score (%)
Lines: Overall | Per department
Tooltip: exact values on hover
```
Library: Recharts LineChart (already in frontend dependency list)

**Section 3: Department Heatmap**
Custom CSS grid (not a Recharts chart):
- Rows: Departments | Columns: Q1, Q2, Q3, Q4
- Cell background: green > 80%, orange 50-80%, red < 50%
- Click cell → drill-down modal
This is the "heatmap" requirement from BRD Section 5.4.

**Section 4: Goal Distribution (Pie + Bar)**
- Pie: goals by UoM type
- Bar: goals by status
- Bar: goals by Thrust Area
Library: Recharts PieChart + BarChart

**Manager Effectiveness Table:**
- Columns: Manager | Team Size | Avg Approval Days | Team Score | Checkin Rate
- Sortable columns
- Conditional formatting: red if checkin rate < 70%

**At-Risk Employee List:**
- Sortable by risk level
- "At Risk" badge if Q trajectory < 50%
- One-click to trigger escalation for that employee

---

## Feature 4 — Microsoft Entra ID (Azure AD) SSO
**Priority: Build Last | Effort: High | Risk: Medium**
**Only attempt if Features 1, 2, 3 are complete and at least 6 hours remain**

### What It Enables
- Login with Atomberg Microsoft account — no separate password
- Org hierarchy auto-synced from Azure AD (manager_id populated automatically)
- Role assignment from Azure AD group membership
- No manual user creation — Azure is the source of truth

### Integration with Existing Architecture
The Azure auth endpoint issues the same JWT token as email/password auth.
Once the JWT is issued, the rest of the system (RBAC, services, repositories)
is completely unchanged. The auth layer is the only extension point.
This is Clean Architecture — auth mechanism is isolated from business logic.

### Implementation Plan

**OAuth 2.0 Authorization Code Flow with PKCE:**
1. User clicks "Sign in with Microsoft" on login page
2. Frontend redirects to Azure: `https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize`
   with: client_id, scope (openid, profile, email, User.Read, Directory.Read.All)
3. User authenticates with Microsoft
4. Microsoft redirects to `/api/v1/auth/azure/callback` with auth code
5. Backend exchanges code for tokens via MSAL library
6. Backend decodes id_token → email, display_name, azure_object_id
7. Azure AD group → role mapping:
   - `CADENCE-Managers` group → role = manager
   - `CADENCE-HR` group → role = admin
   - All others → role = employee
8. Backend upserts user in users table (by email)
9. Backend issues our JWT → same session flow as email/password auth

**New endpoints (additions only):**
- `GET /api/v1/auth/azure/login` → returns Azure redirect URL
- `GET /api/v1/auth/azure/callback` → exchanges code → returns JWT

**Org hierarchy sync via Microsoft Graph API:**
- `GET /users/{azure_id}/manager` → fetch direct manager per user
- Update manager_id in users table on first login
- Schedule nightly re-sync via APScheduler

**Graceful fallback:**
If AZURE_TENANT_ID env var is missing → system falls back to email/password.
Demo accounts always work. Makes the implementation robust.

**Login page change:**
- Option A: "Sign in with Microsoft" (SSO)
- Option B: "Sign in with email" (existing)
Both options visible. Azure button redirects to backend `/auth/azure/login`.

### Demo Setup
1. Create free Azure AD tenant (Microsoft 365 Developer Program)
2. Register app in Azure portal (5 minutes)
3. Create two groups: CADENCE-Managers, CADENCE-HR
4. Create test users in those groups
5. Show: click Microsoft → authenticates → portal loads with correct role

---

## Implementation Timeline (Post Phase 1 + Phase 2 complete)

```
Hour 1–2:   Email channel — Resend setup + 4 key Jinja2 templates + test
Hour 3:     Teams channel — Webhook + Adaptive Cards + deep links + test
Hour 4:     Escalation DB tables + EscalationScheduler + Admin UI rule config
Hour 5:     EscalationService + escalation_log + resolution tracking + test
Hour 6–7:   Analytics endpoints (read from snapshots — mostly already done)
Hour 8–9:   Analytics dashboard — 4 Recharts components + heatmap + at-risk list
Hour 10:    Azure AD SSO (only if time permits and Features 1-3 tested)
Hour 11:    End-to-end testing of all 4 features
Hour 12:    Architecture diagram + submission doc + final deploy check
```

---

## How to Demo All 4 Features in 3 Minutes

Don't demo features separately. One connected narrative:

1. **Admin configures escalation rule** → "This is how HR sets automated governance"
2. **Advance time or manual trigger** → escalation fires
3. **Employee receives email** → open it in browser → shows Jinja2 HTML template with deep link
4. **Employee clicks deep link** → opens exact portal page (shows deep link works)
5. **Teams card appears** in demo Teams channel visible on screen (have this pre-open)
6. **Go to Analytics** → show QoQ trend line → click department heatmap cell → drill down
7. **"This is what HR sees at board level"** — one sentence, massive impact
8. (If Azure done) → click "Sign in with Microsoft" → logs in → hierarchy auto-populated

This narrative demonstrates all 4 features as ONE coherent enterprise system,
not 4 disconnected widgets. Judges remember stories, not feature lists.

---

## Evaluation Criterion Mapping

| Bonus Feature | Good-to-Have ✓ | Cost Optimisation ✓ | Functionality ✓ |
|---|---|---|---|
| Email (Resend) | High visual impact | Free 3,000/mo | Triggers on real events |
| Teams Webhook | Directly from BRD | Free | Adaptive Cards + deep links |
| Escalation Engine | Rule-based, configurable | No extra cost | Works with CheckinTracker |
| Analytics | QoQ + heatmap (BRD req) | Reads snapshots (fast) | Live data from Phase 2 |
| Azure AD SSO | Enterprise SSO | Free dev tenant | Fallback auth preserved |
