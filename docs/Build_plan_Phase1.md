# Build Plan — Phase 1: Goal Creation & Approval
# AtomQuest Hackathon 2026 | Enterprise-Grade Implementation

> Philosophy: Build like Workday/SAP SuccessFactors — every action is an event,
> every change is versioned, every rule is enforced at the service layer, not the UI.

---

## 0. Foundation First — Before Any Feature

### 0.1 Database Schema Design (Think Before You Code)

Design all tables together as a unified schema — not one at a time.
The biggest mistake is designing `goals` without thinking about `goal_versions`, `audit_log`,
and `goal_events` upfront. Schema changes mid-hackathon break everything.

**Tables to create in Phase 1:**

#### `users`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `email` VARCHAR(255) UNIQUE NOT NULL
- `hashed_password` TEXT NOT NULL
- `full_name` VARCHAR(255) NOT NULL
- `role` ENUM('employee', 'manager', 'admin') NOT NULL
- `manager_id` UUID FK → users(id) NULLABLE  ← Self-referential for hierarchy
- `department_id` UUID FK → departments(id)
- `employee_code` VARCHAR(50) UNIQUE  ← Real HR systems always have this
- `is_active` BOOLEAN DEFAULT true
- `created_at`, `updated_at` TIMESTAMPS

**Design note:** `manager_id` being self-referential allows infinite hierarchy depth.
This is how Workday models org structure — not a separate "reporting" table.

#### `departments`
- `id`, `name`, `head_user_id` FK → users(id), `created_at`

#### `goals`
- `id` UUID PRIMARY KEY
- `user_id` UUID FK → users(id)  ← Goal owner
- `goal_sheet_id` UUID FK → goal_sheets(id)  ← A goal belongs to a sheet (cycle-scoped)
- `title` VARCHAR(500) NOT NULL
- `description` TEXT
- `thrust_area` ENUM(...)  ← Configurable by Admin
- `uom_type` ENUM('min', 'max', 'timeline', 'zero')
- `target_value` DECIMAL(15, 4)  ← High precision — supports %, counts, money
- `target_date` DATE NULLABLE  ← Used only when uom_type = 'timeline'
- `weightage` DECIMAL(5, 2)  ← e.g. 25.00 = 25%
- `status` ENUM('draft', 'submitted', 'under_review', 'approved', 'locked', 'archived')
- `is_shared` BOOLEAN DEFAULT false  ← True if pushed from Admin as shared KPI
- `source_shared_goal_id` UUID FK → goals(id) NULLABLE  ← Links to original KPI
- `version` INTEGER DEFAULT 1  ← Optimistic locking counter
- `locked_at` TIMESTAMP NULLABLE
- `locked_by` UUID FK → users(id) NULLABLE
- `cycle_id` UUID FK → cycle_config(id)
- `created_at`, `updated_at`

**Design note:** `version` column enables optimistic locking — if two users try
to update simultaneously, the second update fails with a conflict error.
This is how enterprise systems prevent data corruption.

#### `goal_sheets`
- `id`, `user_id`, `cycle_id`, `status` ENUM('draft', 'submitted', 'approved')
- Total weightage is validated at the SHEET level, not goal level
- One sheet per employee per cycle
- Managers approve the sheet, not individual goals

**Design note:** Separating Goal from GoalSheet is critical. A "Goal Sheet" is the
container for all 8 goals. Workday/SAP both have this distinction.
Validation (100% weightage, max 8 goals) runs at the sheet level.

#### `goal_versions` (Immutable snapshot table)
- `id`, `goal_id` FK → goals(id), `version_number`
- `title`, `description`, `uom_type`, `target_value`, `target_date`, `weightage`
- `status` (what the status was at this version)
- `changed_by` UUID FK → users(id)
- `change_reason` TEXT  ← Required when a Manager edits during review
- `snapshot_at` TIMESTAMP
- UNIQUE(goal_id, version_number)

**Design note:** This is called "temporal data management". Every state change
creates a new row here. Goal table stores current state. Version table stores history.
SAP calls this "change document". Never overwrite — always append.

#### `goal_events` (The event log — heart of enterprise thinking)
- `id`, `goal_id`, `event_type` ENUM (see below), `actor_id`, `payload` JSONB, `occurred_at`

Event types:
- `GOAL_CREATED`, `GOAL_SUBMITTED`, `GOAL_RETURNED_FOR_REWORK`
- `GOAL_APPROVED`, `GOAL_LOCKED`, `GOAL_UNLOCKED`
- `TARGET_EDITED_BY_MANAGER`, `WEIGHTAGE_EDITED_BY_MANAGER`
- `SHARED_GOAL_PUSHED`, `SHARED_GOAL_RECEIVED`
- `GOAL_ARCHIVED`

**Design note:** Every action = one event. Events are immutable facts.
This is "Event Sourcing lite" — not full event sourcing but enough for audit.

#### `audit_log`
- `id`, `table_name`, `record_id`, `action` ENUM('INSERT', 'UPDATE', 'DELETE')
- `field_name`, `old_value` TEXT, `new_value` TEXT
- `actor_id`, `actor_role`, `ip_address`, `request_id`
- `changed_at` TIMESTAMP

**Design note:** This is separate from goal_events. audit_log is a low-level
field-by-field change record. goal_events is high-level business events.
Enterprise systems have both. HR audits need the field-level log.

#### `cycle_config`
- `id`, `cycle_name` (e.g. "FY2026"), `phase` ENUM('goal_setting', 'q1', 'q2', 'q3', 'q4')
- `window_open` TIMESTAMP, `window_close` TIMESTAMP
- `is_active` BOOLEAN, `created_by`, `created_at`

#### `role_permissions` (RBAC matrix — database-driven)
- `id`, `role` ENUM, `permission_key` VARCHAR
- Example rows:
  - ('employee', 'CREATE_GOAL'), ('employee', 'SUBMIT_GOAL')
  - ('manager', 'APPROVE_GOAL'), ('manager', 'EDIT_GOAL_IN_REVIEW')
  - ('admin', 'UNLOCK_GOAL'), ('admin', 'PUSH_SHARED_GOAL'), ('admin', 'CONFIGURE_CYCLE')

**Design note:** Permission checks load this table into memory at startup.
Adding a new permission = one SQL insert, no code change.

#### `shared_goals`
- `id`, `source_goal_id` FK → goals(id)  ← The KPI goal Admin created
- `recipient_user_id` FK → users(id)
- `custom_weightage` DECIMAL(5,2)  ← Only field recipients can change
- `is_accepted` BOOLEAN DEFAULT true
- `pushed_at`, `pushed_by`

---

### 0.2 Alembic Migrations Plan

Never create tables manually. Always use Alembic.
Each migration file = one logical change. Never combine everything in one file.

```
001_initial_schema.py        → users, departments
002_goals_and_sheets.py      → goals, goal_sheets
003_goal_versions.py         → goal_versions
004_goal_events.py           → goal_events
005_audit_log.py             → audit_log
006_cycle_config.py          → cycle_config
007_rbac.py                  → role_permissions + seed default permissions
008_shared_goals.py          → shared_goals
```

---

### 0.3 RBAC System Design

Before building any endpoint, build the permission gate.

**Permission Matrix (design this first):**

| Permission Key        | Employee | Manager | Admin |
|-----------------------|----------|---------|-------|
| CREATE_GOAL           | ✅       | ❌      | ❌    |
| SUBMIT_GOAL_SHEET     | ✅       | ❌      | ❌    |
| EDIT_OWN_DRAFT_GOAL   | ✅       | ❌      | ❌    |
| VIEW_OWN_GOALS        | ✅       | ✅      | ✅    |
| VIEW_TEAM_GOALS       | ❌       | ✅      | ✅    |
| APPROVE_GOAL          | ❌       | ✅      | ✅    |
| REJECT_GOAL           | ❌       | ✅      | ✅    |
| EDIT_GOAL_IN_REVIEW   | ❌       | ✅      | ✅    |
| RETURN_FOR_REWORK     | ❌       | ✅      | ✅    |
| PUSH_SHARED_GOAL      | ❌       | ❌      | ✅    |
| UNLOCK_GOAL           | ❌       | ❌      | ✅    |
| CONFIGURE_CYCLE       | ❌       | ❌      | ✅    |
| VIEW_ALL_GOALS        | ❌       | ❌      | ✅    |
| EXPORT_REPORTS        | ❌       | ❌      | ✅    |
| VIEW_AUDIT_LOG        | ❌       | ❌      | ✅    |

**How to enforce:**
FastAPI dependency `require_permission("APPROVE_GOAL")` injected per endpoint.
The dependency checks the RBAC table for the current user's role.
If no permission → 403 Forbidden with message: "You don't have permission to approve goals."

This is not `if user.role == "manager"`. That is amateur.
This is: `rbac_service.has_permission(current_user.role, "APPROVE_GOAL")`. That is enterprise.

---

### 0.4 Goal State Machine Design

The most important design in Phase 1.
Build this before writing a single endpoint.

```
DRAFT ──────────────────────────────────────────────────────────┐
  │                                                              │
  │ Employee submits goal sheet                                  │
  ▼                                                              │
SUBMITTED ───────────────────────────────────────────────────┐  │
  │                                                           │  │
  │ Manager opens for review                                  │  │
  ▼                                                           │  │
UNDER_REVIEW                                                  │  │
  │                │                                          │  │
  │ Manager        │ Manager returns                          │  │
  │ approves       │ for rework                               │  │
  ▼                ▼                                          │  │
APPROVED        DRAFT (back to employee) ────────────────────┘  │
  │                                                              │
  │ System auto-locks on approval                                │
  ▼                                                              │
LOCKED ←── (only Admin can move back) ──────────────────────────┘
  │
  │ End of annual cycle
  ▼
ARCHIVED
```

**GoalStateMachine class responsibilities:**
- Define `ALLOWED_TRANSITIONS` dict: `{ current_state: [allowed_next_states] }`
- Validate the actor has permission to trigger the transition
- Reject invalid transitions with descriptive error: "Cannot approve a goal that is in DRAFT state"
- Fire the corresponding GoalEvent after every successful transition
- Create a GoalVersion snapshot on every transition

**Critical rule:** No service or endpoint should directly update `goals.status`.
Only the GoalStateMachine can change status. This is the Single Responsibility Principle.

---

## 1. Backend — Phase 1 Feature Implementation

### 1.1 Authentication System

**What to build:**
- `POST /api/v1/auth/login` — accepts email + password, returns JWT access token + refresh token
- `POST /api/v1/auth/refresh` — rotates access token using refresh token
- `POST /api/v1/auth/logout` — invalidates refresh token (store invalidated tokens in a blacklist set)
- JWT payload: `{ sub: user_id, role: "manager", permissions: [...], exp: ... }`

**Security decisions (enterprise thinking):**
- Access token short-lived: 15 minutes
- Refresh token longer: 7 days, stored in HttpOnly cookie
- Password hashing: bcrypt with work factor 12
- Rate limiting on login: 5 failed attempts → 15 min lockout (store in Redis or Postgres)
- All endpoints except /login require valid JWT in Authorization header

**Dependency injection pattern:**
```
get_current_user() → validates JWT → returns User object
require_permission(key) → wraps get_current_user → checks RBAC → returns User or 403
```

Every protected endpoint uses `Depends(require_permission("PERMISSION_KEY"))`.

---

### 1.2 Goal Creation Flow

**Endpoints:**

`POST /api/v1/goals/` — Create a single goal (DRAFT status)
- Validate: user has `CREATE_GOAL` permission
- Validate: active goal_setting window is open (cycle_service.is_window_open())
- Validate: employee has fewer than 8 goals in current cycle
- Validate: individual weightage >= 10%
- Validate: weightage is a number with max 2 decimal places
- Create goal with status = DRAFT
- Create GoalVersion (version 1) snapshot
- Fire GOAL_CREATED event → audit handler logs it
- Return: full GoalResponse with goal_id

`GET /api/v1/goals/my-sheet` — Get current employee's goal sheet with all goals
- Returns: goal_sheet + list of goals + running weightage total + validation status

`PUT /api/v1/goals/{goal_id}` — Edit own DRAFT goal
- Validate: goal exists + belongs to current user
- Validate: goal is in DRAFT status (cannot edit if SUBMITTED or beyond)
- Validate: permission `EDIT_OWN_DRAFT_GOAL`
- Apply changes via GoalService (not directly)
- Create new GoalVersion snapshot
- Fire GOAL_UPDATED event

`DELETE /api/v1/goals/{goal_id}` — Soft-delete a DRAFT goal
- Only allowed in DRAFT status
- Sets is_deleted = true (never hard delete)
- Re-validates remaining weightage sum

`POST /api/v1/goals/submit-sheet` — Submit the entire goal sheet for approval
- This is a SHEET-LEVEL action, not per-goal
- Validate ALL goals together:
  - Total weightage of non-deleted goals == 100% (exactly, not approx)
  - All goals in DRAFT status
  - Goal count between 1 and 8
  - No goal with weightage < 10%
- All goals transition: DRAFT → SUBMITTED via StateMachine
- GoalSheet status → SUBMITTED
- Fire GOAL_SHEET_SUBMITTED event
- Notify manager (NotificationService.notify_manager_of_submission)
- Return: full sheet with validation confirmation

**Service layer — GoalService responsibilities:**
- `create_goal(user_id, goal_data, cycle_id)` → validates + creates
- `validate_sheet(goal_sheet_id)` → runs all 4 validation rules, returns ValidationResult object
- `submit_sheet(goal_sheet_id, employee_id)` → validates → transitions all goals → fires events
- `get_my_sheet(user_id, cycle_id)` → fetches sheet with running stats

**Repository layer — GoalRepository responsibilities:**
- `count_goals_in_cycle(user_id, cycle_id)` → int
- `sum_weightage_in_cycle(user_id, cycle_id)` → Decimal
- `get_sheet_with_goals(sheet_id)` → GoalSheet with joined goals
- `get_pending_for_manager(manager_id)` → List[GoalSheet] awaiting approval
- No business logic here — pure data access only

---

### 1.3 Manager Approval Workflow

**Endpoints:**

`GET /api/v1/approvals/pending` — Manager's queue of submitted goal sheets
- Returns: list of employees + their goal sheets awaiting review
- Sorted by submission date (oldest first — FIFO queue)
- Includes: employee name, dept, submission time, goal count, total weightage

`GET /api/v1/approvals/{sheet_id}` — Full goal sheet for review
- Returns: all goals + versions + history for this sheet
- Manager can see if this was returned for rework previously

`POST /api/v1/approvals/{sheet_id}/approve` — Approve the full sheet
- Validate: permission `APPROVE_GOAL`
- Validate: sheet is in SUBMITTED or UNDER_REVIEW status
- Validate: no conflicting concurrent edit (check version counter)
- Transition all goals: SUBMITTED → APPROVED → LOCKED via StateMachine
- Set locked_at, locked_by on each goal
- Create GoalVersion snapshot for each goal (final approved version)
- GoalSheet status → APPROVED
- Fire GOAL_SHEET_APPROVED event
- NotificationService notifies employee of approval
- AuditHandler logs approval with manager_id

`POST /api/v1/approvals/{sheet_id}/return-for-rework` — Send back to employee
- Required body: `{ reason: "Please reduce goal 3 target to be more realistic" }`
- reason is mandatory — no blank returns
- Transition: SUBMITTED/UNDER_REVIEW → DRAFT
- Employee notified with the reason
- GoalEvent logged: GOAL_RETURNED_FOR_REWORK with reason in payload

`PATCH /api/v1/approvals/{sheet_id}/goals/{goal_id}` — Manager inline edit during review
- Allowed fields: `target_value`, `target_date`, `weightage` ONLY
- Manager CANNOT change: title, description, uom_type, thrust_area
- Each edit creates a GoalVersion snapshot with `changed_by = manager_id`
- `change_reason` is required in the request body
- AuditLog entry: field_name, old_value, new_value, changed_by, timestamp
- Re-validate total weightage after edit

**ApprovalService responsibilities:**
- `get_pending_approvals(manager_id)` → fetches team's submitted sheets
- `approve_sheet(sheet_id, manager_id)` → runs state transitions + events
- `return_for_rework(sheet_id, manager_id, reason)` → transitions + notification
- `inline_edit(goal_id, field, new_value, manager_id, reason)` → validates + updates + versions

**Concurrency handling:**
When manager opens a sheet for review, that sheet transitions to UNDER_REVIEW.
This prevents another manager from reviewing the same sheet simultaneously.
On approve/reject, system checks that version counter hasn't changed since sheet was opened.
If version mismatch → 409 Conflict: "This goal sheet was modified since you opened it."

---

### 1.4 Shared Goals Feature

**Design (Admin pushes department KPI to multiple employees):**

`POST /api/v1/admin/shared-goals/push`
- Body: `{ source_goal_data: {...}, recipient_user_ids: [uuid1, uuid2, ...] }`
- Admin creates ONE "master" goal record (is_shared=true, user_id=admin)
- For each recipient: create a linked goal record with:
  - title, thrust_area, uom_type, target_value COPIED from master (read-only fields)
  - weightage = recipient's chosen value (default: suggested, editable)
  - source_shared_goal_id = master goal id
  - status = DRAFT (appears in employee's sheet automatically)
- Employee sees this goal pre-populated in their sheet
- Employee can ONLY change: weightage (min 10%, max subject to their total)
- All other fields show "(Shared — read-only)" label in UI
- Fire SHARED_GOAL_PUSHED event for each recipient

**Achievement sync mechanism:**
When the primary owner (admin or designated employee) logs achievement for the master goal,
SharedGoalSyncHandler propagates actual_value to all linked goal records automatically.
Recipients do NOT manually enter achievement for shared goals — it's read-only there too.

**Repository consideration:**
`get_linked_goals(source_goal_id)` → returns all shared_goals rows for sync

---

### 1.5 Goal Unlock (Admin)

`POST /api/v1/admin/goals/{goal_id}/unlock`
- Permission: `UNLOCK_GOAL` (admin only)
- Required body: `{ reason: "..." }` — mandatory reason
- Transitions: LOCKED → UNDER_REVIEW (not DRAFT — goes back to manager)
- Creates GoalEvent: GOAL_UNLOCKED with reason + admin_id
- Creates AuditLog entry (this is a post-lock change — must be logged)
- Notifies both employee and manager

---

### 1.6 Cycle Configuration (Admin)

`GET /api/v1/admin/cycles/` — List all cycle configurations
`POST /api/v1/admin/cycles/` — Create a new phase window
`PATCH /api/v1/admin/cycles/{cycle_id}` — Update window dates
`POST /api/v1/admin/cycles/{cycle_id}/activate` — Activate a window

**CycleService.get_active_window():**
- Returns the currently active phase
- Called by GoalService and AchievementService before accepting any write
- Response cached for 5 minutes (dashboard always fetches this)

**Window enforcement:**
This is a middleware-level concern. CycleGuard dependency injected into every
write endpoint that is window-sensitive. Returns 403 with message:
"Goal setting window is closed. Next window opens in July."

---

### 1.7 Version History & Audit Trail (Admin view)

`GET /api/v1/goals/{goal_id}/versions` — Full version history
- Returns: chronological list of GoalVersion records
- Each version shows: what changed, who changed it, when, what status it was

`GET /api/v1/audit-log` — Admin-only audit log
- Filters: date range, actor_id, table_name, action
- Shows: field-level changes with old/new values
- Paginated (never return all rows)

---

## 2. Frontend — Phase 1 Feature Implementation

### 2.1 Authentication & Role Routing

**LoginPage:**
- Single login form for all 3 roles (email + password)
- On success: decode JWT, store role + permissions in Zustand authStore
- Redirect based on role: employee → /employee/dashboard, manager → /manager/dashboard, admin → /admin/dashboard

**ProtectedRoute component:**
- Wraps every page that requires authentication
- Also accepts optional `requiredPermission` prop
- If no auth → redirect to /login
- If authenticated but no permission → show 403 page (not redirect — show in place)

**AppShell + Sidebar:**
- Sidebar items filtered by `hasPermission()` hook — no hardcoded role checks
- Shows current user's name, role badge, department
- Notification bell with unread count

---

### 2.2 Employee Goal Sheet UI

**My Goals page — the core employee interface:**

Layout: 
- Top: CycleStatusBanner — "Goal Setting Window: Open until 31 May" (or closed)
- WeightageBar: big visual progress bar "75% / 100%" with colour coding
  - Green: 100% exactly
  - Orange: between 70-99%
  - Red: over 100% or any goal < 10%
  - Shows count: "5 / 8 goals added"
- Goal list: cards with title, UoM badge, target, weightage, status badge
- Add Goal button (disabled when sheet submitted)

**GoalForm — creating a goal:**
- Thrust Area: searchable dropdown
- Title: text input with character count
- Description: optional rich text
- UoM Type selector: shows explanation for each type ("Higher is better — e.g. sales revenue")
- Target Value: number input (shows unit label based on UoM)
- Target Date: date picker (only shown when uom_type = timeline)
- Weightage: number input + live validation
  - Shows remaining allocatable weightage: "35% remaining"
  - Red if this goal would push total over 100%
  - Red if value < 10%

**Submit Sheet flow:**
- "Submit for Approval" button — disabled until 100% weightage + at least 1 goal
- On click: show ConfirmDialog listing all validation results
- On confirm: call submit-sheet API, show success toast, disable all editing

**After submission:**
- All goal cards switch to read-only view
- Show "Awaiting Manager Approval" status across the sheet
- If returned for rework: show manager's reason prominently + unlock editing

---

### 2.3 Manager Approval UI

**Approval Queue page:**
- Table: Employee | Department | Goals | Submitted At | Status | Actions
- "Review" button opens GoalReviewPage

**GoalReviewPage — the most important manager screen:**

Layout:
- Employee header: name, department, submission date, number of times returned
- WeightageBar (manager sees same view as employee)
- GoalTimeline: shows if this is first submission or rework
- Goal table (inline editable):
  - Each row: Title | UoM | Target | Weightage | Edit icon
  - Clicking Edit icon → inline input fields (target, weightage only)
  - Saving edit: requires "reason for change" dialog → creates version
- Bottom actions:
  - "Return for Rework" button → opens dialog requiring reason text
  - "Approve Sheet" button → ConfirmDialog → approves + locks

**GoalVersionDrawer:**
- Slide-out from right side
- Shows full chronological history for each goal
- Each version: what changed, who changed it (employee or manager), when, reason

---

### 2.4 Admin Console UI

**Admin Dashboard:**
- Metric cards: Total employees, Sheets submitted, Sheets approved, Sheets pending
- Org completion rate donut chart
- Department-level breakdown table

**Cycle Configuration page:**
- Table of all phase windows
- Each row: Phase | Opens | Closes | Status | Edit
- "Activate Window" toggle (only one phase active at a time)
- Date range picker for editing windows

**Shared Goal Push page:**
- Step 1: Define the shared KPI goal (same form as employee but for admin)
- Step 2: Select recipients (multi-select from employee list, filterable by dept)
- Step 3: Preview + confirm push
- After push: shows list of recipients with their pre-filled goal status

**Audit Trail page:**
- Filterable table: Date | Actor | Role | Action | Table | Field | Old Value | New Value
- "Post-lock changes only" toggle (most important filter for HR audits)
- Export to CSV button

---

## 3. Data Structures & OOP Patterns Used in Phase 1

### 3.1 GoalStateMachine (Pattern: State Machine)
- Encapsulates all valid state transitions
- Single responsibility: knows nothing about HTTP, DB, or notifications
- Used by every service that needs to change goal status
- Makes adding new states trivial (one entry in transitions dict)

### 3.2 GoalEventBus (Pattern: Observer / Pub-Sub)
- Services publish events without knowing who handles them
- AuditHandler and NotificationHandler subscribe independently
- Adding a new side effect = new handler, zero changes to existing code (Open/Closed Principle)

### 3.3 BaseRepository (Pattern: Repository + Template Method)
- Provides generic CRUD that all repositories inherit
- Each concrete repository adds only domain-specific methods
- Swapping PostgreSQL for another DB = rewriting only repositories (Liskov Substitution)

### 3.4 ValidationResult (Pattern: Result Object)
- `validate_sheet()` returns `ValidationResult { is_valid: bool, errors: List[ValidationError] }`
- Never raises exceptions for business rule violations — returns structured results
- Frontend receives the full list of what's wrong (not just the first error)

### 3.5 APIResponse Wrapper (Pattern: Decorator / Envelope)
- Every response: `{ success: bool, data: T, error: ErrorDetail | null, meta: PaginationMeta | null }`
- Frontend always knows the response shape — no guessing
- Consistent error format: `{ code: "GOAL_NOT_FOUND", message: "...", field: "goal_id" }`

---

## 4. Phase 1 Validation Checklist (Run Before Demo)

- [ ] Employee can create up to 8 goals — 9th is blocked with error
- [ ] Weightage < 10% is rejected at API level (not just frontend)
- [ ] Total weightage != 100% blocks sheet submission
- [ ] Submitted goal sheet is read-only for employee
- [ ] Manager can edit ONLY target and weightage (not title/UoM)
- [ ] Every manager edit requires a reason and creates a version
- [ ] Approved goal transitions to LOCKED — no further edits possible
- [ ] Locked goal edit attempt returns 403 with "Goal is locked" message
- [ ] Admin can unlock a goal with a reason
- [ ] Shared goal's title/target is read-only for recipient employees
- [ ] Shared goal's weightage IS editable
- [ ] Cycle window is closed → all write operations blocked with appropriate message
- [ ] Goal version history shows all changes chronologically
- [ ] Audit log shows all post-lock changes
- [ ] All 3 demo users can log in and access their respective dashboards
- [ ] RBAC: Employee cannot access manager or admin endpoints
- [ ] RBAC: Manager cannot access admin endpoints

---

## 5. Phase 1 Definition of Done

Phase 1 is complete when ALL of the following work end-to-end on the live URL:

1. Employee logs in → creates 3-8 goals → total weightage reaches 100% → submits for approval
2. Manager logs in → sees pending sheet → optionally edits targets → approves
3. Goals are now locked — employee sees read-only view with "Approved" badges
4. Admin logs in → configures cycle window → pushes a shared KPI to 2 employees
5. Both employees see shared goal pre-populated (read-only fields)
6. Admin views audit trail — sees all changes made during approval
7. Admin unlocks a goal — it goes back to manager for re-review
