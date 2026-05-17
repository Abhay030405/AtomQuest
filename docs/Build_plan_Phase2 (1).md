# Build Plan — Phase 2: Achievement Tracking & Quarterly Check-ins
# AtomQuest Hackathon 2026 | Enterprise-Grade Implementation

> Philosophy: Phase 2 is where the data lives. Every quarterly update is sacred —
> immutable, versioned, timestamped. Think of it as a financial ledger.
> You never overwrite — you only append.

> Architecture alignment: Phase 2 fully inherits the Modular Monolith +
> Event-Driven Side Effects + Lite CQRS + Immutable Versioning decisions
> made for the overall system. Every service, handler and data structure
> below follows those patterns without exception.

---

## 0. Phase 2 Prerequisites

Phase 2 ONLY starts after Phase 1 is fully working:
- Goals are LOCKED after manager approval
- Cycle config table has quarterly windows configured
- At least 1 employee has approved + locked goals to track
- EventBus is wired — AuditHandler + NotificationHandler already subscribed (Phase 1)
- RBAC matrix seeded — CONDUCT_CHECKIN and LOG_ACHIEVEMENT permissions exist

---

## 1. Database Schema — Phase 2 Tables

### Architectural note — ALL Phase 2 tables follow the same BaseModel contract:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at`, `updated_at` TIMESTAMPS auto-managed
- `is_deleted` BOOLEAN DEFAULT false — soft delete, never hard delete
No Phase 2 table violates these rules.

---

### `achievements` (Append-only ledger — never overwrite)
- `id` UUID PRIMARY KEY
- `goal_id` UUID FK → goals(id)
- `quarter` ENUM('q1','q2','q3','q4')
- `actual_value` DECIMAL(15,4) NULLABLE — NULL = not yet submitted
- `actual_date` DATE NULLABLE — used only when uom_type = 'timeline'
- `status` ENUM('not_started','on_track','completed')
- `computed_score` DECIMAL(8,4) — auto-computed by ScoringService, stored permanently
- `score_formula_used` VARCHAR(50) — 'min'|'max'|'timeline'|'zero' for audit
- `submitted_at` TIMESTAMP
- `submitted_by` UUID FK → users(id)
- `is_synced_from_shared` BOOLEAN DEFAULT false — set by SharedGoalSyncHandler
- UNIQUE(goal_id, quarter) — one record per goal per quarter

**Immutable versioning design (SAP SuccessFactors pattern):**
Re-submission flow:
1. Read current achievement record
2. INSERT into achievement_versions (snapshot of current)
3. UPDATE achievements with new values
This is the same Temporal Data Management pattern as goal_versions in Phase 1.
Consistent across the entire system — no exceptions.

---

### `achievement_versions` (Immutable snapshot — append only)
- `id` UUID PRIMARY KEY
- `achievement_id` UUID FK → achievements(id)
- `version_number` INTEGER NOT NULL
- `actual_value` DECIMAL(15,4)
- `actual_date` DATE NULLABLE
- `status` ENUM('not_started','on_track','completed')
- `computed_score` DECIMAL(8,4)
- `score_formula_used` VARCHAR(50)
- `submitted_at` TIMESTAMP
- `submitted_by` UUID FK → users(id)
- `edit_reason` TEXT NOT NULL — always required, no silent re-submissions
- UNIQUE(achievement_id, version_number)

**Design note:** Admin "Achievement changes only" audit trail filter queries
this table. Every version is traceable to a specific user and timestamp.

---

### `checkins`
- `id` UUID PRIMARY KEY
- `manager_id` UUID FK → users(id)
- `employee_id` UUID FK → users(id)
- `quarter` ENUM('q1','q2','q3','q4')
- `cycle_id` UUID FK → cycle_config(id)
- `comment` TEXT NOT NULL — min 20 characters enforced at service layer
- `comment_type` ENUM('structured','freeform') DEFAULT 'freeform'
- `goals_discussed` UUID[] NULLABLE — goal IDs covered in this check-in
- `overall_rating_sentiment` ENUM('positive','neutral','needs_attention') NULLABLE
- `completed_at` TIMESTAMP
- `is_acknowledged_by_employee` BOOLEAN DEFAULT false — Workday-style ack
- `acknowledged_at` TIMESTAMP NULLABLE
- UNIQUE(manager_id, employee_id, quarter, cycle_id)

**Acknowledgement design (mention in demo):**
After manager submits → CHECKIN_COMPLETED fires → NotificationHandler notifies
employee → employee clicks Acknowledge → sets flag + fires CHECKIN_ACKNOWLEDGED
→ manager notified in-app. Not in BRD but shows enterprise thinking.

---

### `checkin_events` (Event log for all check-in mutations)
- `id` UUID PRIMARY KEY
- `checkin_id` UUID FK → checkins(id)
- `event_type` ENUM('CREATED','UPDATED','ACKNOWLEDGED')
- `actor_id` UUID FK → users(id)
- `payload` JSONB — what changed: old/new comment, timestamps
- `occurred_at` TIMESTAMP

**Why separate from audit_log:**
audit_log is field-level (old_val → new_val).
checkin_events is high-level business semantics — ACKNOWLEDGED is a meaningful
business event, not just a boolean flip. Same dual-log pattern as goal_events.

---

### `analytics_snapshots` (NEW — Lite CQRS Read Projection)
This table is the most important architectural addition from our decisions.

- `id` UUID PRIMARY KEY
- `quarter` ENUM('q1','q2','q3','q4')
- `cycle_id` UUID FK → cycle_config(id)
- `user_id` UUID FK → users(id)
- `department_id` UUID FK → departments(id)
- `manager_id` UUID FK → users(id)
- `weighted_score` DECIMAL(8,4) — Σ(goal_score × weightage)/100
- `goals_total` INTEGER
- `goals_submitted` INTEGER
- `goals_completed` INTEGER
- `checkin_done` BOOLEAN DEFAULT false
- `achievement_submitted` BOOLEAN DEFAULT false
- `snapshot_generated_at` TIMESTAMP
- UNIQUE(user_id, quarter, cycle_id)

**CQRS Lite design (Twitter/LinkedIn pattern):**
The completion dashboard and analytics pages NEVER query live goals/achievements
tables directly. They read from this snapshot table — the read model.
The write model (achievements, checkins) keeps this snapshot current via:
- ACHIEVEMENT_LOGGED → SnapshotUpdateHandler rebuilds user's row
- CHECKIN_COMPLETED → SnapshotUpdateHandler sets checkin_done = true
Dashboard loads in O(1) per user — reads 1 row, not a 5-table JOIN.
This is the difference between a student project and enterprise software.

---

## 2. Event Bus — Phase 2 New Handlers (from architecture decision)

Phase 2 adds new handlers to the EventBus established in Phase 1.
All handlers are independent subscribers — zero coupling to the services that fire them.
Adding a new side effect = one new handler class. Zero changes to existing code.
This is the Open/Closed Principle at the architecture level.

### New events fired in Phase 2:
- `ACHIEVEMENT_LOGGED` — AchievementService after every save
- `ACHIEVEMENT_RESUBMITTED` — when version is created on re-submission
- `CHECKIN_COMPLETED` — CheckinService after manager submits comment
- `CHECKIN_UPDATED` — manager edits comment within window
- `CHECKIN_ACKNOWLEDGED` — employee clicks Acknowledge
- `SHARED_ACHIEVEMENT_SYNCED` — SharedGoalSyncHandler after propagation

### SnapshotUpdateHandler (NEW — CQRS projection updater)
Subscribes to: ACHIEVEMENT_LOGGED, ACHIEVEMENT_RESUBMITTED, CHECKIN_COMPLETED
Action: recalculates and UPSERTs analytics_snapshots for the affected user+quarter
Called synchronously after DB write — read model always consistent with write model.

### SharedGoalSyncHandler (NEW — shared goal propagation)
Subscribes to: ACHIEVEMENT_LOGGED
Checks: is goal.is_shared = true?
If yes: calls SharedGoalSyncService.sync_achievement() for all linked recipients
Creates achievement_version for recipients that already had a record
Sets is_synced_from_shared = true on all recipient rows
Does NOT notify recipients — background sync, no noise

### AuditHandler (existing — extended for Phase 2)
Now also subscribes to: ACHIEVEMENT_LOGGED, ACHIEVEMENT_RESUBMITTED, CHECKIN_COMPLETED
Writes to audit_log: table_name, field, old_val, new_val, actor_id, timestamp
Powers the "Achievement changes only" filter in Admin audit trail.

### NotificationHandler (existing — extended for Phase 2)
CHECKIN_COMPLETED → email + in-app to employee with deep link to check-in page
ACHIEVEMENT_RESUBMITTED → in-app only to manager (low priority)
CHECKIN_ACKNOWLEDGED → in-app only to manager

---

## 3. ScoringService — The Formula Engine

Pure, stateless class. Zero DB calls. Zero HTTP calls. Fully unit-testable.
Input: uom_type, target_value, actual_value, target_date, actual_date
Output: ScoreResult { score: Decimal, percentage: str, formula_used: str, notes: str }

### Strategy Pattern Implementation
```python
class ScoringStrategy(ABC):          # Abstract base — Liskov Substitution
    @abstractmethod
    def compute(self, target, actual, **kwargs) -> ScoreResult: ...

class MinScoringStrategy(ScoringStrategy): ...    # Higher is better
class MaxScoringStrategy(ScoringStrategy): ...    # Lower is better
class TimelineScoringStrategy(ScoringStrategy): ...  # Date-based
class ZeroScoringStrategy(ScoringStrategy): ...   # Zero = success

class ScoringService:                # Context — selects and delegates
    _strategies = {
        UoMType.MIN:      MinScoringStrategy(),
        UoMType.MAX:      MaxScoringStrategy(),
        UoMType.TIMELINE: TimelineScoringStrategy(),
        UoMType.ZERO:     ZeroScoringStrategy(),
    }
    def compute(self, uom_type, target, actual, **kwargs) -> ScoreResult:
        return self._strategies[uom_type].compute(target, actual, **kwargs)
```
New UoM type = one new class + one dict entry. Zero other changes.
This is Open/Closed Principle in practice. Mention this to judges explicitly.

### Formula 1 — MIN (Higher is better)
```
score = actual_value / target_value
```
- target_value = 0 → DivisionByZeroError: "Target cannot be zero for MIN type"
- actual_value > target_value → score > 1.0, cap display at 2.0
- actual_value = 0 → score = 0.0 (valid)
- negative values → rejected by Pydantic schema before reaching service

### Formula 2 — MAX (Lower is better)
```
score = target_value / actual_value
```
- actual_value = 0 → score = 1.5 with note "Achievement of zero — verify data"
- actual_value > target_value → score < 1.0 (missed)
- actual_value = target_value → score = 1.0 (exactly met)

### Formula 3 — TIMELINE (Date-based)
```
if actual_date <= target_date         → score = 1.0   (on time)
elif actual_date is None and today < target_date  → score = None  (in progress)
elif actual_date is None and today > target_date  → score = 0.0   (overdue)
else:
    days_late = (actual_date - target_date).days
    score = max(0, 1.0 - days_late * PENALTY_PER_DAY)
```
PENALTY_PER_DAY default 0.05 — configurable in cycle_config.
Document as deliberate business rule in demo.

### Formula 4 — ZERO (Zero = Success)
```
if round(actual_value) == 0:   # round first: 0.001 → 0 → 100%
    score = 1.0
else:
    score = 0.0
```
- actual_value < 0 → rejected at Pydantic schema level
- No partial credit — strictly binary per BRD

### Required tests before Phase 2 goes live:
- min: actual=0, =target, >target, target=0 (DivisionByZero)
- max: actual=0, =target, >target
- timeline: early, exact, 1-day late, 5-days late, overdue no date, in-progress
- zero: 0, 1, 0.001 (float), negative (schema reject)

---

## 4. Backend — Phase 2 Endpoints

### 4.1 Achievement Logging (Employee)

`GET /api/v1/achievements/my-quarter`
Returns: all locked goals + existing achievements if any
Includes: { window_open, window_close, days_remaining, is_open }
Shared goals show is_synced_from_shared = true → frontend disables input

`POST /api/v1/achievements/`
Single-goal submission for current quarter.
Validate at SERVICE LAYER (not frontend only):
- CycleGuard: window open → else 403
- RBAC: LOG_ACHIEVEMENT permission
- Goal belongs to current user and is LOCKED
- Goal is not a received shared goal
- actual_value ≥ 0 (Pydantic rejects negatives)
- status is one of 3 values
Compute score via ScoringService (Strategy Pattern dispatch)
UPSERT (UNIQUE goal_id + quarter):
- First: INSERT new record
- Re-submit: INSERT achievement_version first → UPDATE main record
Fire ACHIEVEMENT_LOGGED → EventBus fans out to all handlers

`POST /api/v1/achievements/bulk`
All goals in one atomic DB transaction.
Either all succeed or all fail — no partial state ever.
Preferred employee flow: fill all cards → click "Submit All"

`GET /api/v1/achievements/my-history`
All quarters for current user.
Used by QoQ sparklines in "My Progress" view.

---

### 4.2 Manager Check-in Module

`GET /api/v1/checkins/team-status`
**Reads from analytics_snapshots (CQRS read model — NOT live tables)**
Returns pre-computed: achievement_submitted, checkin_done, weighted_score per employee
Sorted: checkin_done=false first (pending at top)
Fast: O(1) per employee row from snapshot table

`GET /api/v1/checkins/employee/{employee_id}`
Detailed view — reads live tables (accuracy needed here, not just speed)
Returns: all goals + actuals + scores + QoQ delta + existing check-in if done
Permission: employee must be in manager's direct reports (hierarchy check)

`POST /api/v1/checkins/`
Validate at SERVICE LAYER:
- RBAC: CONDUCT_CHECKIN permission
- Employee is manager's direct report
- CycleGuard: window open
- comment.length ≥ 20 → else 400
- UNIQUE check → else 409 Conflict
Create checkin record
Fire CHECKIN_COMPLETED → EventBus:
  NotificationHandler: email + in-app to employee
  SnapshotUpdateHandler: checkin_done = true on snapshot
  AuditHandler: logs creation

`PATCH /api/v1/checkins/{checkin_id}`
Amend comment within same window.
Creates checkin_event of type UPDATED.
Cannot change employee_id or quarter.

`POST /api/v1/checkins/{checkin_id}/acknowledge`
Employee acknowledges check-in.
Sets is_acknowledged_by_employee = true.
Fires CHECKIN_ACKNOWLEDGED → NotificationHandler notifies manager in-app.
Demo line: "This is how Workday handles check-in acknowledgements."

---

### 4.3 Admin — Reporting & Governance

`GET /api/v1/reports/completion-dashboard`
**Reads from analytics_snapshots (CQRS read model)**
Aggregates by dept and manager — no live JOIN queries.
Returns heatmap data: { dept, total, submitted, checkins_done, pct }

`GET /api/v1/reports/achievement`
Paginated. Uses ReportBuilder (Builder Pattern) with fluent filters.
Includes WeightedScoreAggregator result per employee.

`GET /api/v1/reports/achievement/export`
StreamingResponse — memory-efficient for large exports.
CSV: Employee | Code | Dept | Manager | Goal | UoM | Target | Actual | Score | Status | Quarter
Empty data → returns headers only, never an error.

`GET /api/v1/reports/overdue`
Uses CheckinCompletionTracker.get_overdue_users(quarter)
Shows employees not submitted + managers not checked in.
Days remaining in window shown for urgency.
Used by admin dashboard and Escalation engine.

`GET /api/v1/audit-log` (Phase 2 extension)
Now includes achievement + checkin events.
Filter param: type=achievement_only for admin toggle.

---

### 4.4 Shared Goal Achievement Sync

**SharedGoalSyncService.sync_achievement(source_goal_id, quarter):**
1. Fetch achievement for source_goal_id + quarter
2. Query shared_goals for all recipients of source_goal_id
3. For each recipient's linked goal_id:
   - If achievement exists: INSERT version → UPDATE record (is_synced_from_shared=true)
   - If not exists: INSERT new record (is_synced_from_shared=true)
   - Recompute score via ScoringService (same UoM + target + actual)
4. Fire SHARED_ACHIEVEMENT_SYNCED per recipient
5. SnapshotUpdateHandler rebuilds snapshot per recipient
6. Recipients NOT notified — background sync only

---

## 5. Frontend — Phase 2 UI

### 5.1 Employee — Quarterly Achievement Entry

**QuarterlyUpdate page:**
- WindowStatusBanner: "Q1 Window: Open until 31 July (12 days)"
- Closed state: red/orange "Window Closed — Q2 opens in October"
- Quarter tabs Q1|Q2|Q3|Q4 (past quarters read-only)

Goal cards:
- Title + thrust area badge + UoM badge
- Planned target (read-only, locked)
- Actual input (number or date picker by UoM)
  - Shared goals: disabled, label "Auto-synced from shared KPI"
- Status dropdown: Not Started | On Track | Completed
- Live score preview computed client-side via scoring.util.ts
  - "Predicted score: 85%" with formula tooltip on hover
- Previous quarter mini-comparison strip

Bottom actions:
- "Save Draft" — saves without finalising
- "Submit Q{n} Achievement" — active only when all goals complete
  - ConfirmDialog before submitting (cannot be undone)

Post-submission PlannedVsActual table:
- Read-only: Goal | Target | Actual | Score | Status
- Colour-coded scores: green > 80%, orange 50-80%, red < 50%
- Sparkline bar per goal
- "Awaiting Manager Check-in" indicator

---

### 5.2 Manager — Check-in Module

**TeamCheckinDashboard (reads from analytics_snapshots):**
- Metric cards: Total | Submitted | Done | Window Closes In
- Completion ring (% done)
- Employee list sorted: pending first
- Status chips: ⏳ Pending | ✅ Done | ❌ Not submitted | 🔒 Missed

**Employee detail (reads live tables for accuracy):**
- PlannedVsActual table with score bars
- Overall Weighted Score card (WeightedScoreAggregator result)
- QoQ delta arrows ↑↓→
- Check-in comment textarea with live char count (min 20)
- Submit → ConfirmDialog → POST
- After submit: read-only with timestamp + Edit button (within window)

---

### 5.3 Admin — Completion Dashboard & Reports

**Completion Dashboard (reads analytics_snapshots — CQRS):**
- Department heatmap: dept rows × Q1/Q2/Q3/Q4 columns
- Click cell → manager-level drill-down
- Overdue card

**Achievement Report:**
- Quarter/Department/Manager filters
- Built by ReportBuilder
- Export CSV (StreamingResponse)
- Weighted score per employee

**Audit Trail (Phase 2 enhancement):**
- "Achievement changes only" toggle
- Re-submission version diff visible
- Shared sync entries labelled

---

## 6. Data Structures & OOP Patterns — Phase 2

### 6.1 ScoringStrategy (Pattern: Strategy — Open/Closed Principle)
Abstract + 4 concrete classes. ScoringService selects via dict lookup.
New UoM = 1 class + 1 dict entry. Zero other changes.

### 6.2 AchievementLedger (Pattern: Append-Only / Temporal Data)
Never UPDATE without creating version first.
`AchievementService.resubmit(id, new_data, reason)` enforces contract.
Consistent with GoalVersion in Phase 1.

### 6.3 ReportBuilder (Pattern: Builder — Fluent API)
```python
report = (AchievementReportBuilder()
    .for_quarter('q1')
    .for_department(dept_id)
    .include_scores()
    .include_qoq_comparison()
    .build())
CSVExporter.export(report)  # StreamingResponse
```

### 6.4 CheckinCompletionTracker (Pattern: Specification)
```python
class CheckinSpecification:
    def is_overdue(employee_id, quarter) -> bool
    def has_submitted(employee_id, quarter) -> bool
    def has_checkin(manager_id, employee_id, quarter) -> bool
    def get_overdue_users(quarter) -> List[OverdueUser]
```
Used by: completion dashboard, overdue endpoint, Escalation engine.
All "who has done what" logic centralised here — no duplicated queries.

### 6.5 WeightedScoreAggregator (Custom Data Structure)
```python
class WeightedScoreAggregator:
    _goals: List[Tuple[Optional[Decimal], Decimal]]  # (score|None, weightage)

    def add(self, score: Optional[Decimal], weightage: Decimal) -> None

    def compute(self) -> Optional[Decimal]:
        # Σ(score × weightage) / Σ(weightage of scored goals only)
        # Returns None if zero goals have scores yet
        # Gracefully ignores None scores

    def completion_rate(self) -> float:
        # % goals with non-null scores (0.0–1.0)
```
Used by: CheckinService, ReportService, SnapshotUpdateHandler.

### 6.6 SnapshotProjection (Pattern: CQRS Read Model Updater — NEW)
```python
class SnapshotUpdateHandler:
    # Subscribes to ACHIEVEMENT_LOGGED, CHECKIN_COMPLETED events
    def handle(self, event: GoalEvent) -> None:
        user_id  = event.payload['user_id']
        quarter  = event.payload['quarter']
        cycle_id = event.payload['cycle_id']
        snapshot = self._build_snapshot(user_id, quarter, cycle_id)
        self.snapshot_repo.upsert(snapshot)  # analytics_snapshots
```
Keeps read model always fresh. Dashboard query time: O(1) per user row.
Decoupled from write path — added as an event subscriber, zero service changes.

---

## 7. Phase 2 Edge Cases — Must Handle All

| Scenario | Expected Behaviour |
|---|---|
| Employee submits after window closes | 403: "Q1 window is closed. Next window opens in October." |
| Employee re-submits (second time) | achievement_version created, edit_reason required |
| Max UoM actual_value = 0 | Score = 1.5 with note "Achievement of zero — please verify" |
| Min UoM target_value = 0 | 400: "Target cannot be zero for higher-is-better goal" |
| Zero UoM actual_value = 0.001 (float) | round(0.001) = 0 → 100% score |
| Timeline UoM no actual_date, deadline passed | Score = 0.0, status = "missed" |
| Shared goal — owner logs achievement | SharedGoalSyncHandler propagates silently |
| Manager checks in before employee submits | UI warning shown, check-in allowed |
| Check-in comment < 20 chars | 400: "Comment must be at least 20 characters" |
| Received shared goal — employee tries to log | 403: "Managed by the goal owner" |
| Employee has 0 locked goals | Empty state: "No approved goals for this cycle" |
| Admin exports empty report | CSV with headers only, no error |
| Concurrent achievement submit | DB UNIQUE(goal_id, quarter) → 409 Conflict |
| analytics_snapshots row missing | SnapshotUpdateHandler creates fresh row on first event |
| Re-submission of shared goal | SharedGoalSyncHandler re-propagates, creates version for recipients |

---

## 8. Phase 2 Definition of Done

Phase 2 is complete when ALL of the following work end-to-end on live URL:

1. Employee → Q1 window open → enters actuals + status → submits
2. Scores computed by correct Strategy class → displayed with formula tooltip
3. analytics_snapshots updated after submission (team-status reflects instantly)
4. Manager → team-status reads from snapshots (fast, no live JOINs)
5. Manager → employee detail loads from live tables (accurate)
6. Manager → check-in comment ≥ 20 chars → submits → employee emailed + in-app
7. Employee → acknowledges check-in → manager notified in-app
8. Admin → completion heatmap reads from snapshots → correct %
9. Admin → exports CSV → StreamingResponse → all columns present
10. Shared goal owner logs → all recipients auto-synced
11. Outside window → blocked with correct 403 message
12. Re-submission creates achievement_version → visible in audit trail
13. All 4 UoM formulas pass edge case tests
14. EventBus audit trail shows every Phase 2 event with actor + timestamp
