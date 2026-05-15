# AtomQuest Goal Portal — Universal Production-Grade Folder Structure

> Stack: FastAPI (Python) · React + TypeScript · PostgreSQL · Tailwind + shadcn/ui
> Architecture: Layered (Repository → Service → API) · Event-Driven · RBAC · State Machine

```
atomquest-portal/
│
├── backend/                                   # FastAPI Python Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                            # App entrypoint, middleware registration, router mount
│   │   │
│   │   ├── api/                               # Transport layer — only handles HTTP in/out
│   │   │   ├── deps.py                        # Dependency injection: get_db(), get_current_user(), require_permission()
│   │   │   └── v1/
│   │   │       ├── router.py                  # Mounts all endpoint routers under /api/v1
│   │   │       └── endpoints/
│   │   │           ├── auth.py                # POST /login, POST /refresh, POST /logout
│   │   │           ├── goals.py               # CRUD + state transitions for goals
│   │   │           ├── goal_versions.py       # GET version history for a goal
│   │   │           ├── achievements.py        # Quarterly achievement logging
│   │   │           ├── checkins.py            # Manager check-in module
│   │   │           ├── shared_goals.py        # Admin push shared KPIs
│   │   │           ├── users.py               # User management, org hierarchy
│   │   │           ├── admin.py               # Cycle config, goal unlock, org setup
│   │   │           ├── reports.py             # CSV export, completion dashboard
│   │   │           ├── audit.py               # Audit log viewer
│   │   │           └── notifications.py       # In-app notification fetch/mark-read
│   │   │
│   │   ├── core/                              # Cross-cutting concerns
│   │   │   ├── config.py                      # Pydantic BaseSettings — all env vars typed
│   │   │   ├── security.py                    # JWT encode/decode, password hashing (bcrypt)
│   │   │   ├── database.py                    # SQLAlchemy async engine, session factory
│   │   │   ├── exceptions.py                  # Custom HTTP exceptions + global handler
│   │   │   ├── logging.py                     # Structured JSON logging (structlog)
│   │   │   └── constants.py                   # GoalStatus enum, UoMType enum, Quarter enum, Permissions enum
│   │   │
│   │   ├── models/                            # SQLAlchemy ORM — represents DB tables
│   │   │   ├── base.py                        # BaseModel: id (UUID), created_at, updated_at, is_deleted (soft delete)
│   │   │   ├── user.py                        # User: email, hashed_password, role, manager_id (self-ref FK), department_id
│   │   │   ├── department.py                  # Department: name, head_id
│   │   │   ├── goal.py                        # Goal: title, thrust_area, uom_type, target, weightage, status (state machine), is_locked, version
│   │   │   ├── goal_version.py                # GoalVersion: full snapshot on every state change (immutable)
│   │   │   ├── goal_event.py                  # GoalEvent: event_type, payload JSON, actor_id, timestamp
│   │   │   ├── shared_goal.py                 # SharedGoal: source_goal_id, recipient_user_id, custom_weightage
│   │   │   ├── achievement.py                 # Achievement: goal_id, quarter, actual_value, status, computed_score
│   │   │   ├── checkin.py                     # Checkin: manager_id, employee_id, quarter, comment, completed_at
│   │   │   ├── audit_log.py                   # AuditLog: table_name, record_id, field, old_val, new_val, actor_id, action, timestamp
│   │   │   ├── cycle_config.py                # CycleConfig: phase_name, window_open, window_close, is_active, org_id
│   │   │   ├── notification.py                # Notification: recipient_id, type, title, body, is_read, deep_link
│   │   │   └── permission.py                  # RolePermission: role, permission_key (RBAC matrix table)
│   │   │
│   │   ├── schemas/                           # Pydantic — request validation & response serialisation
│   │   │   ├── common.py                      # PaginatedResponse, APIResponse wrapper, ErrorDetail
│   │   │   ├── user.py                        # UserCreate, UserResponse, UserWithHierarchy
│   │   │   ├── auth.py                        # LoginRequest, TokenResponse, RefreshRequest
│   │   │   ├── goal.py                        # GoalCreate, GoalUpdate, GoalResponse, GoalWithVersions
│   │   │   ├── goal_version.py                # GoalVersionResponse (read-only snapshot)
│   │   │   ├── achievement.py                 # AchievementCreate, AchievementResponse, ScoreBreakdown
│   │   │   ├── checkin.py                     # CheckinCreate, CheckinResponse, TeamCheckinSummary
│   │   │   ├── shared_goal.py                 # SharedGoalPush, SharedGoalResponse
│   │   │   ├── report.py                      # AchievementReportRow, CompletionSummary
│   │   │   └── audit.py                       # AuditLogResponse, AuditFilter
│   │   │
│   │   ├── services/                          # Business logic — pure Python, no HTTP, no DB queries directly
│   │   │   ├── goal_service.py                # GoalService: create, transition_state(), validate_weightage(), enforce_max_goals()
│   │   │   ├── goal_state_machine.py          # StateMachine class: allowed_transitions dict, transition(), validate_actor()
│   │   │   ├── approval_service.py            # ApprovalService: approve(), reject(), request_rework(), inline_edit()
│   │   │   ├── achievement_service.py         # AchievementService: log_achievement(), enforce_window(), sync_shared_goals()
│   │   │   ├── scoring_service.py             # ScoringService: compute_score(uom_type, target, actual) — all 4 formulas
│   │   │   ├── checkin_service.py             # CheckinService: create_checkin(), get_team_status(), mark_complete()
│   │   │   ├── shared_goal_service.py         # SharedGoalService: push_to_employees(), sync_achievement()
│   │   │   ├── audit_service.py               # AuditService: log_change(), log_event(), get_history()
│   │   │   ├── cycle_service.py               # CycleService: get_active_window(), is_window_open(), get_current_quarter()
│   │   │   ├── report_service.py              # ReportService: generate_achievement_csv(), get_completion_dashboard()
│   │   │   ├── notification_service.py        # NotificationService: send(), queue(), mark_read() — channel-agnostic
│   │   │   ├── rbac_service.py                # RBACService: has_permission(user, permission_key), load_matrix()
│   │   │   └── version_service.py             # VersionService: snapshot_goal(), get_diff(v1, v2)
│   │   │
│   │   ├── repositories/                      # Data access layer — all DB queries live here ONLY
│   │   │   ├── base_repository.py             # BaseRepository: get(), get_all(), create(), update(), soft_delete()
│   │   │   ├── user_repository.py             # UserRepo: get_by_email(), get_team(), get_hierarchy_tree()
│   │   │   ├── goal_repository.py             # GoalRepo: get_by_employee(), get_pending_approvals(), get_with_lock()
│   │   │   ├── achievement_repository.py      # AchievementRepo: get_by_goal_quarter(), get_team_summary()
│   │   │   ├── checkin_repository.py          # CheckinRepo: get_completion_rate(), get_overdue()
│   │   │   ├── audit_repository.py            # AuditRepo: get_by_record(), get_by_actor(), get_post_lock()
│   │   │   ├── cycle_repository.py            # CycleRepo: get_active(), update_window()
│   │   │   └── shared_goal_repository.py      # SharedGoalRepo: get_recipients(), get_linked_goals()
│   │   │
│   │   ├── events/                            # Event-driven architecture — decouple side effects
│   │   │   ├── event_bus.py                   # In-process EventBus: publish(event), subscribe(event_type, handler)
│   │   │   ├── goal_events.py                 # GoalSubmittedEvent, GoalApprovedEvent, GoalRejectedEvent, GoalLockedEvent,
│   │   │   │                                  # GoalUnlockedEvent, WeightageChangedEvent, CheckinCompletedEvent
│   │   │   └── handlers/
│   │   │       ├── audit_handler.py           # Subscribes to all events → writes to audit_log
│   │   │       ├── notification_handler.py    # Subscribes to events → sends email/in-app notifications
│   │   │       └── sync_handler.py            # Subscribes to AchievementLoggedEvent → syncs shared goals
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth_middleware.py             # Extracts + validates JWT on every request
│   │   │   ├── rbac_middleware.py             # Checks permission before endpoint execution
│   │   │   ├── request_id_middleware.py       # Injects X-Request-ID for tracing
│   │   │   └── logging_middleware.py          # Logs every request: method, path, duration, status, user_id
│   │   │
│   │   └── utils/
│   │       ├── date_utils.py                  # quarter_from_date(), is_in_window(), days_until_close()
│   │       ├── export_utils.py                # dict_to_csv(), generate_csv_response()
│   │       ├── validators.py                  # validate_weightage_sum(), validate_goal_count() — shared pure functions
│   │       └── pagination.py                  # paginate_query(), PaginationParams
│   │
│   ├── migrations/                            # Alembic DB migrations (version-controlled schema changes)
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 001_create_users.py
│   │       ├── 002_create_goals_and_versions.py
│   │       ├── 003_create_achievements.py
│   │       ├── 004_create_checkins.py
│   │       ├── 005_create_audit_and_events.py
│   │       ├── 006_create_cycle_config.py
│   │       ├── 007_create_shared_goals.py
│   │       └── 008_create_notifications.py
│   │
│   ├── tests/
│   │   ├── conftest.py                        # Test DB setup, fixtures, test client
│   │   ├── unit/
│   │   │   ├── test_goal_state_machine.py     # State transition logic
│   │   │   ├── test_scoring_service.py        # All 4 UoM formula edge cases
│   │   │   ├── test_validators.py             # Weightage, goal count rules
│   │   │   └── test_cycle_service.py          # Window enforcement logic
│   │   └── integration/
│   │       ├── test_goal_lifecycle.py         # Full: create → submit → approve → lock
│   │       ├── test_approval_flow.py
│   │       └── test_achievement_flow.py
│   │
│   ├── scripts/
│   │   ├── seed_data.py                       # Seeds 3 demo users + sample goals for all roles
│   │   └── reset_db.py                        # Drops + recreates tables (dev only)
│   │
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx                           # ReactDOM.render, providers
│   │   ├── App.tsx                            # Router + layout shell
│   │   │
│   │   ├── types/                             # All TypeScript interfaces — single source of truth
│   │   │   ├── goal.types.ts                  # Goal, GoalVersion, GoalStatus, UoMType, ThrustArea enums
│   │   │   ├── user.types.ts                  # User, Role, OrgNode (hierarchy tree)
│   │   │   ├── achievement.types.ts           # Achievement, Quarter, ScoreBreakdown
│   │   │   ├── checkin.types.ts               # Checkin, TeamCheckinStatus
│   │   │   ├── audit.types.ts                 # AuditLog, GoalEvent
│   │   │   ├── report.types.ts                # AchievementReportRow, CompletionSummary
│   │   │   └── api.types.ts                   # APIResponse<T>, PaginatedResponse<T>, ErrorDetail
│   │   │
│   │   ├── constants/                         # App-wide constants — no magic strings anywhere
│   │   │   ├── goalStatus.ts                  # GoalStatus enum values + display labels + colours
│   │   │   ├── uomTypes.ts                    # UoM type definitions + formula descriptions
│   │   │   ├── permissions.ts                 # Permission keys (mirrors backend RBAC matrix)
│   │   │   ├── quarters.ts                    # Quarter definitions + window months
│   │   │   └── routes.ts                      # All route paths as constants
│   │   │
│   │   ├── store/                             # Zustand global state — minimal, server state in React Query
│   │   │   ├── authStore.ts                   # currentUser, token, role, permissions[]
│   │   │   ├── notificationStore.ts           # unread count, notification list
│   │   │   └── cycleStore.ts                  # activeWindow, currentQuarter, isWindowOpen
│   │   │
│   │   ├── hooks/                             # Custom React hooks
│   │   │   ├── useAuth.ts                     # login(), logout(), currentUser, hasPermission()
│   │   │   ├── useGoals.ts                    # useQuery wrappers for goal API calls
│   │   │   ├── usePermissions.ts              # hasPermission(key) → boolean
│   │   │   ├── useWindowStatus.ts             # isWindowOpen, daysRemaining, currentQuarter
│   │   │   ├── useWeightage.ts                # Live weightage calculator + validation
│   │   │   └── useAuditLog.ts                 # Fetch goal history
│   │   │
│   │   ├── services/                          # API layer — all fetch calls here, nowhere else
│   │   │   ├── api.client.ts                  # Axios instance: base URL, JWT interceptor, error handler
│   │   │   ├── auth.service.ts                # login(), refresh(), logout()
│   │   │   ├── goal.service.ts                # createGoal(), submitGoal(), getMyGoals(), getGoalVersions()
│   │   │   ├── approval.service.ts            # approveGoal(), rejectGoal(), returnForRework()
│   │   │   ├── achievement.service.ts         # logAchievement(), getTeamAchievements()
│   │   │   ├── checkin.service.ts             # createCheckin(), getTeamCheckinStatus()
│   │   │   ├── admin.service.ts               # updateCycleConfig(), unlockGoal(), pushSharedGoal()
│   │   │   └── report.service.ts              # downloadCSV(), getCompletionDashboard()
│   │   │
│   │   ├── components/                        # Reusable UI components
│   │   │   ├── ui/                            # shadcn/ui base: Button, Input, Dialog, Toast, Badge, Table, etc.
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx               # Sidebar + topbar + content area
│   │   │   │   ├── Sidebar.tsx                # Role-aware nav (shows only permitted items)
│   │   │   │   ├── Topbar.tsx                 # User info, notification bell, role badge
│   │   │   │   └── ProtectedRoute.tsx         # Checks auth + permission before rendering
│   │   │   │
│   │   │   ├── goals/
│   │   │   │   ├── GoalForm.tsx               # Controlled form: title, UoM, target, weightage, thrust area
│   │   │   │   ├── GoalCard.tsx               # Single goal display with status badge + actions
│   │   │   │   ├── GoalStatusBadge.tsx        # Coloured badge for each GoalStatus
│   │   │   │   ├── WeightageBar.tsx           # Live progress bar: X% / 100% with validation colour
│   │   │   │   ├── GoalTimeline.tsx           # Visual state machine: shows all past states chronologically
│   │   │   │   ├── GoalVersionDrawer.tsx      # Slide-out panel showing full version history
│   │   │   │   └── UoMSelector.tsx            # Dropdown with UoM explanation tooltips
│   │   │   │
│   │   │   ├── achievements/
│   │   │   │   ├── AchievementForm.tsx        # Quarterly entry: actual value + status per goal
│   │   │   │   ├── ScoreDisplay.tsx           # Computed score with formula explanation
│   │   │   │   └── PlannedVsActual.tsx        # Side-by-side comparison table
│   │   │   │
│   │   │   ├── checkin/
│   │   │   │   ├── CheckinForm.tsx            # Manager comment form (required field)
│   │   │   │   ├── TeamCheckinTable.tsx       # All reports: status, scores, checkin done?
│   │   │   │   └── ProgressScoreBar.tsx       # Visual score per goal
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── AuditLogTable.tsx          # Sortable, filterable audit trail table
│   │   │       ├── CompletionHeatmap.tsx      # Dept × Quarter completion grid
│   │   │       ├── DataTable.tsx              # Generic reusable table with sort + paginate
│   │   │       ├── WindowStatusBanner.tsx     # "Q2 window closes in 3 days" sticky banner
│   │   │       ├── EmptyState.tsx             # Friendly empty states for all lists
│   │   │       └── ConfirmDialog.tsx          # Reusable confirmation modal
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── LoginPage.tsx
│   │   │   │
│   │   │   ├── employee/
│   │   │   │   ├── EmployeeDashboard.tsx      # Overview: goal count, pending submissions, window status
│   │   │   │   ├── MyGoals.tsx                # Goal sheet with weightage bar + state badges
│   │   │   │   ├── CreateGoal.tsx             # Goal creation wizard
│   │   │   │   └── QuarterlyUpdate.tsx        # Achievement entry for active quarter
│   │   │   │
│   │   │   ├── manager/
│   │   │   │   ├── ManagerDashboard.tsx       # Pending approvals count, check-in completion %
│   │   │   │   ├── ApprovalQueue.tsx          # List of submitted goals awaiting review
│   │   │   │   ├── GoalReviewPage.tsx         # Full goal sheet with inline edit + approve/reject
│   │   │   │   ├── TeamGoals.tsx              # All team goals, all statuses
│   │   │   │   └── CheckinModule.tsx          # Team planned-vs-actual + comment entry
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx         # Org-wide completion rates, pending actions
│   │   │       ├── CycleConfig.tsx            # Configure phase windows, activate/deactivate
│   │   │       ├── SharedGoalPush.tsx         # Select KPI + push to employees
│   │   │       ├── AuditTrail.tsx             # Full audit log with filters
│   │   │       ├── GoalUnlock.tsx             # Search employee goal + unlock with reason
│   │   │       └── Reports.tsx                # Achievement report with CSV export
│   │   │
│   │   └── utils/
│   │       ├── scoring.util.ts                # Client-side UoM score preview (mirrors backend logic)
│   │       ├── date.util.ts                   # formatDate(), quarterLabel(), daysUntil()
│   │       ├── format.util.ts                 # formatScore(), formatWeightage(), formatStatus()
│   │       └── permission.util.ts             # canPerformAction(user, action) → boolean
│   │
│   ├── public/
│   │   └── favicon.ico
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── docs/
│   ├── architecture.md                        # System architecture overview
│   ├── api-spec.yaml                          # OpenAPI 3.0 spec (auto-generated by FastAPI)
│   ├── database-schema.md                     # All tables with field descriptions
│   ├── rbac-matrix.md                         # Permission matrix: role × permission_key
│   ├── state-machine.md                       # Goal lifecycle diagram + allowed transitions
│   └── scoring-formulas.md                    # All 4 UoM formulas with examples
│
├── scripts/
│   ├── seed_data.py                           # Creates demo org: 1 admin, 2 managers, 6 employees + goals
│   └── reset_db.py                            # Dev-only: drops all tables and re-runs migrations
│
├── .env.example
├── docker-compose.yml                         # Postgres + Backend + Frontend (local dev)
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml                         # CI: lint → test → deploy to Railway + Vercel
```

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Async, auto OpenAPI docs, Pydantic validation, fastest Python framework |
| ORM | SQLAlchemy (async) | Full control, migrations via Alembic, relationship mapping |
| Migrations | Alembic | Version-controlled schema — enterprise standard |
| State machine | Custom GoalStateMachine class | Enforces allowed transitions, prevents invalid state jumps |
| DB queries | Repository pattern only | No raw SQL in services/endpoints — swap DB without touching business logic |
| Business logic | Service layer only | Endpoints are thin — no logic in routes |
| Events | In-process EventBus | Decouples audit logging + notifications from core business logic |
| RBAC | Database-driven permission matrix | Configurable without code changes |
| Frontend state | React Query + Zustand | Server state in RQ, minimal global state in Zustand |
| API response | Wrapped APIResponse<T> | Consistent shape: { success, data, error, meta } |
| Soft delete | is_deleted flag on BaseModel | No data is ever permanently deleted — audit safe |
| Versioning | GoalVersion snapshot table | Every state change snapshots the full goal — full history |
| Concurrency | DB-level row locking on approval | Prevents simultaneous manager + employee edits |
