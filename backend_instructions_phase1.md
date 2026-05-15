# Backend Instructions — Phase 1
# AtomQuest Hackathon 2026 | FastAPI + Neon (Postgres) + SQLAlchemy

> Run these prompts in Claude Code one by one in exact order.
> Never move to the next prompt until the current one runs without errors.
> Stack: FastAPI (Python 3.11+) · Neon (Postgres) · SQLAlchemy (async) · Alembic · Pydantic v2

---

## PROMPT B1 — Project Scaffolding & Environment Setup

Scaffold a new FastAPI Python backend project inside a folder named "backend" at the root of the atomquest-portal project. Do the following in exact order:

Create the complete folder structure as follows:
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── auth.py
│   │           ├── goals.py
│   │           ├── goal_versions.py
│   │           ├── shared_goals.py
│   │           ├── users.py
│   │           ├── admin.py
│   │           ├── reports.py
│   │           ├── audit.py
│   │           └── notifications.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── database.py
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── constants.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── department.py
│   │   ├── goal.py
│   │   ├── goal_sheet.py
│   │   ├── goal_version.py
│   │   ├── goal_event.py
│   │   ├── shared_goal.py
│   │   ├── audit_log.py
│   │   ├── cycle_config.py
│   │   ├── notification.py
│   │   └── permission.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py
│   │   ├── user.py
│   │   ├── auth.py
│   │   ├── goal.py
│   │   ├── goal_version.py
│   │   ├── shared_goal.py
│   │   ├── report.py
│   │   └── audit.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── goal_service.py
│   │   ├── goal_state_machine.py
│   │   ├── approval_service.py
│   │   ├── shared_goal_service.py
│   │   ├── audit_service.py
│   │   ├── cycle_service.py
│   │   ├── report_service.py
│   │   ├── notification_service.py
│   │   ├── rbac_service.py
│   │   └── version_service.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base_repository.py
│   │   ├── user_repository.py
│   │   ├── goal_repository.py
│   │   ├── audit_repository.py
│   │   ├── cycle_repository.py
│   │   └── shared_goal_repository.py
│   ├── events/
│   │   ├── __init__.py
│   │   ├── event_bus.py
│   │   ├── goal_events.py
│   │   └── handlers/
│   │       ├── __init__.py
│   │       ├── audit_handler.py
│   │       └── notification_handler.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── request_id_middleware.py
│   │   └── logging_middleware.py
│   └── utils/
│       ├── __init__.py
│       ├── date_utils.py
│       ├── export_utils.py
│       ├── validators.py
│       └── pagination.py
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── scripts/
│   ├── seed_data.py
│   └── reset_db.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── unit/
│       ├── __init__.py
│       ├── test_goal_state_machine.py
│       ├── test_validators.py
│       └── test_rbac_service.py
├── alembic.ini
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── .env.example
└── .gitignore
```

Create requirements.txt with these exact packages:
fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic, pydantic[email], pydantic-settings, python-jose[cryptography], passlib[bcrypt], python-multipart, structlog, python-dotenv, httpx, aiofiles

Create requirements-dev.txt with:
pytest, pytest-asyncio, pytest-cov, httpx, black, isort, mypy

Create .env.example with these variables (no real values, just keys with example format):
DATABASE_URL=postgresql+asyncpg://user:password@ep-example-123456.neon.tech/atomquest?sslmode=require
SECRET_KEY=your-256-bit-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
APP_NAME=AtomQuest Portal
APP_VERSION=1.0.0

Create a proper .gitignore for Python projects including: __pycache__, .env, .venv, *.pyc, dist/, .pytest_cache/, .mypy_cache/

Create the Dockerfile using Python 3.11-slim base image. It should: install dependencies from requirements.txt, copy the app code, expose port 8000, and run uvicorn with the main app. Use multi-stage build — first stage installs deps, second stage is the runtime image.

After creating all files and folders (empty for now), run "pip install -r requirements.txt" inside a virtual environment to confirm all packages resolve correctly. Report any version conflicts.

---

## PROMPT B2 — Core Foundation: Config, Database, Security, Constants, Exceptions

Build the core foundation layer. Every other module depends on this — it must be correct before anything else is built.

CORE CONFIG (app/core/config.py):
Create a Settings class using Pydantic BaseSettings. It must read all values from environment variables with sensible defaults. Include these fields:
- app_name, app_version, environment (development/staging/production)
- database_url (required, no default — must fail loudly if missing)
- secret_key (required, no default)
- algorithm (default HS256)
- access_token_expire_minutes (default 15)
- refresh_token_expire_days (default 7)
- cors_origins: list of strings parsed from comma-separated env var
- debug: boolean, true only in development
- log_level: default "INFO"

Use model_config with env_file=".env" so it auto-loads the .env file. Export a single settings instance at module level so all other modules import it as: from app.core.config import settings

CONSTANTS (app/core/constants.py):
Define all enumerations used throughout the system as Python Enum classes:

UserRole enum: EMPLOYEE, MANAGER, ADMIN — with string values "employee", "manager", "admin"

GoalStatus enum with string values: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, LOCKED, ARCHIVED

UoMType enum with string values: MIN, MAX, TIMELINE, ZERO

ThrustArea enum with string values: REVENUE_GROWTH, CUSTOMER_SATISFACTION, OPERATIONAL_EXCELLENCE, PEOPLE_DEVELOPMENT, SAFETY_COMPLIANCE, INNOVATION, COST_OPTIMISATION, QUALITY

GoalSheetStatus enum: DRAFT, SUBMITTED, APPROVED

CyclePhase enum: GOAL_SETTING, Q1, Q2, Q3, Q4

AuditAction enum: INSERT, UPDATE, DELETE

GoalEventType enum — all 10 event types: GOAL_CREATED, GOAL_SUBMITTED, GOAL_RETURNED_FOR_REWORK, GOAL_APPROVED, GOAL_LOCKED, GOAL_UNLOCKED, TARGET_EDITED_BY_MANAGER, WEIGHTAGE_EDITED_BY_MANAGER, SHARED_GOAL_PUSHED, SHARED_GOAL_RECEIVED

Permission enum — all 15 keys exactly: CREATE_GOAL, SUBMIT_GOAL_SHEET, EDIT_OWN_DRAFT_GOAL, VIEW_OWN_GOALS, VIEW_TEAM_GOALS, APPROVE_GOAL, REJECT_GOAL, EDIT_GOAL_IN_REVIEW, RETURN_FOR_REWORK, PUSH_SHARED_GOAL, UNLOCK_GOAL, CONFIGURE_CYCLE, VIEW_ALL_GOALS, EXPORT_REPORTS, VIEW_AUDIT_LOG

NotificationType enum: GOAL_SUBMITTED, GOAL_APPROVED, GOAL_RETURNED, GOAL_UNLOCKED, SHARED_GOAL_RECEIVED, CHECKIN_COMPLETED, WINDOW_OPENING

RBAC_MATRIX: a Python dictionary mapping each UserRole to its list of allowed Permission values. This must exactly match the permission matrix from the build plan. Employee gets: CREATE_GOAL, SUBMIT_GOAL_SHEET, EDIT_OWN_DRAFT_GOAL, VIEW_OWN_GOALS. Manager gets: VIEW_OWN_GOALS, VIEW_TEAM_GOALS, APPROVE_GOAL, REJECT_GOAL, EDIT_GOAL_IN_REVIEW, RETURN_FOR_REWORK. Admin gets: all permissions.

DATABASE (app/core/database.py):
Set up SQLAlchemy async engine using asyncpg driver. Create:
- Async engine using create_async_engine with the DATABASE_URL from settings
- echo=True only when settings.debug is True (never echo in production)
- AsyncSessionLocal using async_sessionmaker with expire_on_commit=False
- Base = declarative_base() — all models will inherit from this
- get_db() async generator function that yields a database session and ensures it is closed in a finally block — this is the FastAPI dependency for database access
- init_db() async function that creates all tables using Base.metadata.create_all — called at app startup only in development

SECURITY (app/core/security.py):
Build all authentication and cryptography utilities:
- password hashing: use passlib CryptContext with bcrypt scheme. Functions: hash_password(plain) → str, verify_password(plain, hashed) → bool
- JWT creation: create_access_token(data: dict) → str — encodes with SECRET_KEY, ALGORITHM, expiry from settings. Always include "type": "access" in payload.
- create_refresh_token(data: dict) → str — same but with longer expiry and "type": "refresh"
- decode_token(token: str) → dict — decodes and validates token, raises HTTPException 401 if expired or invalid. Validates the "type" field matches expected.
- Token payload must always contain: sub (user_id as string), role, exp, iat, jti (random UUID for potential blacklisting)

EXCEPTIONS (app/core/exceptions.py):
Create a standardised exception hierarchy:
- AtomQuestException: base exception class with code, message, status_code, field (optional)
- GoalNotFoundError(404): "Goal not found"
- GoalSheetNotFoundError(404): "Goal sheet not found"
- UnauthorizedError(401): "Authentication required"
- ForbiddenError(403): "You don't have permission to perform this action"
- GoalLockedError(403): "This goal is locked and cannot be modified"
- WindowClosedError(403): with dynamic message showing when next window opens
- WeightageError(422): "Total weightage must equal 100%"
- GoalCountError(422): "Maximum 8 goals allowed per employee per cycle"
- MinWeightageError(422): "Each goal must have at least 10% weightage"
- InvalidStateTransitionError(422): dynamic message showing current and attempted state
- DuplicateGoalSheetError(409): "You already have a goal sheet for this cycle"
- UserNotFoundError(404): "User not found"
- CycleNotFoundError(404): "No active cycle configuration found"
- InvalidCredentialsError(401): "Invalid email or password"

Create a global exception handler function that catches AtomQuestException and returns a JSON response in this exact shape:
{
  "success": false,
  "data": null,
  "error": {
    "code": "GOAL_LOCKED",
    "message": "This goal is locked and cannot be modified",
    "field": null
  },
  "meta": null
}

Also create a handler for RequestValidationError (Pydantic validation failures) that formats them the same way with field populated.

LOGGING (app/core/logging.py):
Configure structlog for structured JSON logging. Set up:
- Processors: add timestamp, log level, caller info in development, JSON output in production
- configure_logging() function called at app startup
- get_logger(name) function that returns a bound logger for a specific module

---

## PROMPT B3 — Database Models (SQLAlchemy ORM)

Build all SQLAlchemy ORM models. These represent the database tables. Every model must be complete, correctly typed, and have all relationships defined. Do not create any migrations yet — just the model classes.

BASE MODEL (app/models/base.py):
Create a BaseModel class that all other models will inherit from. It must have:
- id: UUID primary key, auto-generated using gen_random_uuid() at DB level and uuid4() as Python default
- created_at: DateTime with timezone, server_default=func.now(), not nullable
- updated_at: DateTime with timezone, onupdate=func.now(), server_default=func.now()
- is_deleted: Boolean, server_default false, not nullable — for soft deletes
- A soft_delete() method that sets is_deleted=True
- A to_dict() method that returns all column values as a dictionary (used for audit snapshots)

DEPARTMENT MODEL (app/models/department.py):
Table name: departments
Columns: id (from base), name (String 255, unique, not null), head_user_id (UUID FK to users.id, nullable — set after users are created), created_at (from base)
Relationship: head_user (relationship to User, foreign_keys=[head_user_id])

USER MODEL (app/models/user.py):
Table name: users
Columns: id (from base), email (String 255, unique, not null, indexed), hashed_password (Text, not null), full_name (String 255, not null), role (Enum(UserRole), not null), manager_id (UUID FK to users.id, nullable — self-referential), department_id (UUID FK to departments.id, nullable), employee_code (String 50, unique, nullable), is_active (Boolean, default True, not null), created_at, updated_at, is_deleted (from base)
Relationships: manager (self-referential relationship to User, remote_side=[id]), direct_reports (back_populates from manager), department (relationship to Department), goal_sheets (relationship to GoalSheet back_populates owner)
Index: on email and is_deleted combined for fast active user lookups

CYCLE CONFIG MODEL (app/models/cycle_config.py):
Table name: cycle_configs
Columns: id (from base), cycle_name (String 100, not null — e.g. "FY2026"), phase (Enum(CyclePhase), not null), window_open (DateTime with timezone, not null), window_close (DateTime with timezone, not null), is_active (Boolean, default False, not null), created_by (UUID FK to users.id, nullable), created_at, updated_at (from base)
Constraint: only one row can have is_active=True per phase — enforce at application level in the service, not DB constraint
Relationship: creator (relationship to User)

GOAL SHEET MODEL (app/models/goal_sheet.py):
Table name: goal_sheets
Columns: id (from base), user_id (UUID FK to users.id, not null), cycle_id (UUID FK to cycle_configs.id, not null), status (Enum(GoalSheetStatus), default DRAFT, not null), submitted_at (DateTime with timezone, nullable), approved_at (DateTime with timezone, nullable), approved_by (UUID FK to users.id, nullable), returned_count (Integer, default 0, not null — tracks how many times returned for rework), created_at, updated_at, is_deleted (from base)
Unique constraint: one goal sheet per user per cycle — UniqueConstraint(user_id, cycle_id)
Relationships: owner (to User via user_id), approver (to User via approved_by), cycle (to CycleConfig), goals (relationship to Goal back_populates goal_sheet)

GOAL MODEL (app/models/goal.py):
Table name: goals
Columns: id (from base), user_id (UUID FK to users.id, not null), goal_sheet_id (UUID FK to goal_sheets.id, not null), title (String 500, not null), description (Text, nullable), thrust_area (Enum(ThrustArea), not null), uom_type (Enum(UoMType), not null), target_value (Numeric(15,4), nullable — null for TIMELINE type), target_date (Date, nullable — only for TIMELINE type), weightage (Numeric(5,2), not null), status (Enum(GoalStatus), default DRAFT, not null), is_shared (Boolean, default False, not null), source_shared_goal_id (UUID FK to goals.id, nullable — self-referential), version (Integer, default 1, not null), locked_at (DateTime with timezone, nullable), locked_by (UUID FK to users.id, nullable), cycle_id (UUID FK to cycle_configs.id, not null), created_at, updated_at, is_deleted (from base)
Relationships: owner (to User via user_id), goal_sheet (to GoalSheet), versions (relationship to GoalVersion), events (relationship to GoalEvent), source_goal (self-referential to Goal via source_shared_goal_id), locker (to User via locked_by)
Index: on user_id and cycle_id combined, on goal_sheet_id, on status

GOAL VERSION MODEL (app/models/goal_version.py):
Table name: goal_versions
This table is append-only — never update existing rows.
Columns: id (from base), goal_id (UUID FK to goals.id, not null), version_number (Integer, not null), title (String 500, not null), description (Text, nullable), thrust_area (Enum(ThrustArea), not null), uom_type (Enum(UoMType), not null), target_value (Numeric(15,4), nullable), target_date (Date, nullable), weightage (Numeric(5,2), not null), status (Enum(GoalStatus), not null — status at time of snapshot), changed_by (UUID FK to users.id, not null), change_reason (Text, nullable), snapshot_at (DateTime with timezone, not null, server_default=func.now())
Unique constraint: UniqueConstraint(goal_id, version_number)
Relationships: goal (to Goal), changed_by_user (to User)
No updated_at or is_deleted — this table is immutable by design

GOAL EVENT MODEL (app/models/goal_event.py):
Table name: goal_events
This table is append-only — never update or delete rows.
Columns: id (UUID, primary key, auto-generated), goal_id (UUID FK to goals.id, not null), event_type (Enum(GoalEventType), not null), actor_id (UUID FK to users.id, not null), payload (JSON, nullable — stores contextual data like reason, old values), occurred_at (DateTime with timezone, not null, server_default=func.now())
No updated_at, created_at, or is_deleted — only occurred_at
Relationships: goal (to Goal), actor (to User)
Index on goal_id and event_type

SHARED GOAL MODEL (app/models/shared_goal.py):
Table name: shared_goals
Columns: id (from base), source_goal_id (UUID FK to goals.id, not null — the master KPI goal), recipient_user_id (UUID FK to users.id, not null), custom_weightage (Numeric(5,2), nullable — set by recipient), is_accepted (Boolean, default True, not null), pushed_at (DateTime with timezone, not null, server_default=func.now()), pushed_by (UUID FK to users.id, not null), created_at, updated_at (from base)
Unique constraint: UniqueConstraint(source_goal_id, recipient_user_id) — one push per goal per recipient
Relationships: source_goal (to Goal), recipient (to User), pusher (to User)

AUDIT LOG MODEL (app/models/audit_log.py):
Table name: audit_logs
This table is append-only. Never update or delete.
Columns: id (UUID primary key, auto-generated), table_name (String 100, not null), record_id (UUID, not null), action (Enum(AuditAction), not null), field_name (String 100, nullable — null for INSERT/DELETE of whole record), old_value (Text, nullable), new_value (Text, nullable), actor_id (UUID FK to users.id, not null), actor_role (Enum(UserRole), not null — stored denormalised so history is preserved even if role changes), ip_address (String 50, nullable), request_id (String 100, nullable — correlates with request logs), changed_at (DateTime with timezone, not null, server_default=func.now())
Index on table_name+record_id, on actor_id, on changed_at

PERMISSION MODEL (app/models/permission.py):
Table name: role_permissions
Columns: id (Integer primary key autoincrement), role (Enum(UserRole), not null), permission_key (String 100, not null)
Unique constraint: UniqueConstraint(role, permission_key)
No timestamps needed — this is configuration data seeded at startup

NOTIFICATION MODEL (app/models/notification.py):
Table name: notifications
Columns: id (from base), recipient_id (UUID FK to users.id, not null), notification_type (Enum(NotificationType), not null), title (String 255, not null), body (Text, not null), is_read (Boolean, default False, not null), read_at (DateTime with timezone, nullable), deep_link (String 500, nullable — URL to navigate to in the portal), related_goal_id (UUID FK to goals.id, nullable), created_at, updated_at (from base)
Index on recipient_id and is_read combined

After creating all models, update app/models/__init__.py to import all model classes so Alembic can discover them for migrations. Every model must be imported here.

---

## PROMPT B4 — Pydantic Schemas (Request & Response)

Build all Pydantic v2 schemas for request validation and response serialisation. Schemas live in app/schemas/ and are separate from SQLAlchemy models. Never return SQLAlchemy models directly from endpoints — always serialise through schemas.

COMMON SCHEMAS (app/schemas/common.py):
Create generic reusable schemas:

ErrorDetail schema: code (str), message (str), field (str or None)

APIResponse generic schema parametrised with TypeVar T: success (bool), data (T or None), error (ErrorDetail or None), meta (dict or None)
Create two factory class methods: ok(data) → APIResponse with success=True, error=None and fail(code, message, field=None) → APIResponse with success=False, data=None

PaginationMeta schema: total (int), page (int), page_size (int), total_pages (int)

PaginatedData generic schema: items (list of T), meta (PaginationMeta)

All schemas use model_config = ConfigDict(from_attributes=True) so they can be created from SQLAlchemy model instances using model_validate().

AUTH SCHEMAS (app/schemas/auth.py):
LoginRequest: email (EmailStr, required), password (str, required, min length 6)
TokenResponse: access_token (str), refresh_token (str), token_type (str default "bearer"), user (UserResponse — see below)
RefreshRequest: refresh_token (str, required)
LogoutRequest: refresh_token (str, required)

USER SCHEMAS (app/schemas/user.py):
UserBase: email (EmailStr), full_name (str), role (UserRole), department_id (UUID or None), employee_code (str or None)

UserCreate (extends UserBase): password (str, min 8 chars), manager_id (UUID or None)
Add a validator that ensures password has at least one uppercase, one lowercase, one digit.

UserUpdate: full_name (str or None), department_id (UUID or None), manager_id (UUID or None), is_active (bool or None) — all optional

UserResponse (extends UserBase): id (UUID), manager_id (UUID or None), manager_name (str or None — computed, not a DB field), department_name (str or None — computed), is_active (bool), created_at (datetime), permissions (list of str)
The manager_name and department_name fields are populated by the service layer, not automatically by SQLAlchemy.

UserListResponse: id, email, full_name, role, employee_code, department_name, manager_name, is_active — compact version for list views

GOAL SCHEMAS (app/schemas/goal.py):
GoalCreate: title (str, min 3 max 500 chars), description (str or None, max 1000), thrust_area (ThrustArea), uom_type (UoMType), target_value (Decimal or None — required if uom_type is not TIMELINE), target_date (date or None — required if uom_type is TIMELINE), weightage (Decimal, must be >= 10.00 and <= 100.00, max 2 decimal places)
Add a model-level validator: if uom_type is TIMELINE then target_date must be provided and target_value must be None. If uom_type is not TIMELINE then target_value must be provided and target_date must be None. If uom_type is ZERO then target_value must equal 0.

GoalUpdate: same fields as GoalCreate but all optional except id. Can only be used while goal is in DRAFT status — enforcement is in the service layer.

ManagerGoalEdit: target_value (Decimal or None), target_date (date or None), weightage (Decimal or None), change_reason (str, min 20 max 500 chars, required). This schema is used ONLY for the manager inline edit endpoint.

GoalResponse: all goal fields, plus:
- status (GoalStatus)
- is_shared (bool)
- locked_at (datetime or None)
- locked_by_name (str or None)
- version (int)
- created_at, updated_at (datetime)
- owner_name (str — populated by service)
- sheet_status (GoalSheetStatus — from the parent sheet)

GoalWithVersions extends GoalResponse: versions (list of GoalVersionResponse)

GOAL VERSION SCHEMAS (app/schemas/goal_version.py):
GoalVersionResponse: id, goal_id, version_number, title, description, thrust_area, uom_type, target_value, target_date, weightage, status, changed_by (UUID), changed_by_name (str), change_reason (str or None), snapshot_at (datetime)

GOAL SHEET SCHEMAS (app/schemas/goal.py — add to same file):
GoalSheetResponse: id, user_id, cycle_id, status (GoalSheetStatus), goals (list of GoalResponse), total_weightage (Decimal — computed sum), submitted_at (datetime or None), approved_at (datetime or None), approved_by_name (str or None), returned_count (int), cycle_name (str — from cycle), owner_name (str — from user)

SheetSubmitResponse: message (str), sheet (GoalSheetResponse), locked_at (datetime)

SHARED GOAL SCHEMAS (app/schemas/shared_goal.py):
SharedGoalPush: goal_data (GoalCreate), recipient_user_ids (list of UUID, min 1 max 50), suggested_weightage (Decimal, min 10, max 90)

SharedGoalResponse: id, source_goal_id, recipient_user_id, recipient_name (str), custom_weightage (Decimal or None), pushed_at (datetime), pushed_by_name (str)

AUDIT SCHEMAS (app/schemas/audit.py):
AuditLogResponse: id, table_name, record_id, action (AuditAction), field_name (str or None), old_value (str or None), new_value (str or None), actor_id (UUID), actor_name (str — populated by service), actor_role (UserRole), changed_at (datetime)

AuditFilter: date_from (datetime or None), date_to (datetime or None), actor_id (UUID or None), table_name (str or None), action (AuditAction or None), post_lock_only (bool, default False)

REPORT SCHEMAS (app/schemas/report.py):
GoalReportRow: employee_name, employee_code, department, manager_name, goal_title, thrust_area, uom_type, target_value, weightage, sheet_status — all strings or Decimals
OrgCompletionSummary: department_name, total_employees, sheets_submitted, sheets_approved, sheets_pending, completion_percentage (Decimal)
OrgStatsResponse: total_employees, total_sheets, submitted_count, approved_count, pending_count, completion_percentage, department_summaries (list of OrgCompletionSummary)

NOTIFICATION SCHEMAS (app/schemas/notification.py):
NotificationResponse: id, notification_type, title, body, is_read, read_at, deep_link, related_goal_id, created_at
UnreadCountResponse: count (int)

---

## PROMPT B5 — Repository Layer (Data Access)

Build all repository classes. Repositories are the ONLY place where database queries live. Services call repositories — never query the database directly from services or endpoints.

BASE REPOSITORY (app/repositories/base_repository.py):
Create a generic BaseRepository class parametrised with the SQLAlchemy model type. Constructor takes an AsyncSession instance. Implement these methods:

get(id: UUID) → Model or None: fetches by primary key, filters out soft-deleted records (is_deleted=False)

get_or_raise(id: UUID) → Model: calls get(), raises the appropriate NotFoundException if None

get_all(skip: int=0, limit: int=100, include_deleted: bool=False) → list[Model]: fetches all records with pagination

create(data: dict) → Model: creates a new instance, adds to session, flushes (not commits — let the service control transactions), returns the instance

update(instance: Model, data: dict) → Model: updates only the provided fields on the instance, flushes, returns updated instance

soft_delete(instance: Model) → Model: sets is_deleted=True and updated_at, flushes

count(filters: list = None) → int: returns count of non-deleted records matching optional filters

All methods are async. Never call session.commit() inside repositories — commit is the service layer's responsibility.

USER REPOSITORY (app/repositories/user_repository.py):
Extends BaseRepository for the User model. Add:

get_by_email(email: str) → User or None: case-insensitive lookup, only active non-deleted users

get_active_by_id(id: UUID) → User or None: same as get() but also checks is_active=True

get_team(manager_id: UUID) → list[User]: returns all direct reports of a manager (where manager_id=manager_id), only active non-deleted users

get_all_employees(department_id: UUID or None = None) → list[User]: returns all users with role=EMPLOYEE, optionally filtered by department

get_hierarchy_tree(root_user_id: UUID) → list[User]: recursive query to get all users in the subtree below a given manager. Use a CTE (Common Table Expression) for this.

get_users_with_role(role: UserRole) → list[User]: returns all active users with specified role

GOAL REPOSITORY (app/repositories/goal_repository.py):
Extends BaseRepository for the Goal model. Add:

get_by_user_and_cycle(user_id: UUID, cycle_id: UUID) → list[Goal]: returns all non-deleted goals for an employee in a cycle, ordered by created_at

get_sheet_for_user(user_id: UUID, cycle_id: UUID) → GoalSheet or None: fetches the goal sheet with all its goals eagerly loaded using selectinload

get_pending_approvals(manager_id: UUID) → list[GoalSheet]: returns all goal sheets where:
  - the sheet owner has manager_id = manager_id
  - sheet status is SUBMITTED or UNDER_REVIEW
  - sheet is not deleted
  Use a join from GoalSheet to User to filter by manager.

count_goals_in_cycle(user_id: UUID, cycle_id: UUID) → int: count of non-deleted goals for user in cycle

sum_weightage_in_cycle(user_id: UUID, cycle_id: UUID) → Decimal: sum of weightage for non-deleted goals

get_locked_goals(employee_id: UUID or None = None) → list[Goal]: returns all goals with status=LOCKED, optionally filtered by employee

get_with_versions(goal_id: UUID) → Goal or None: fetches goal with versions relationship eagerly loaded

get_team_goals(manager_id: UUID, cycle_id: UUID) → list[Goal]: all goals of all direct reports of a manager in a given cycle. Joins Goal → User → manager_id filter.

AUDIT REPOSITORY (app/repositories/audit_repository.py):
Extends BaseRepository for AuditLog model. Add:

log(table_name, record_id, action, actor_id, actor_role, field_name=None, old_value=None, new_value=None, ip_address=None, request_id=None) → AuditLog: creates an audit log entry and flushes. This is a fire-and-forget write — never fails silently but also never blocks the main operation.

get_filtered(filters: AuditFilter, skip: int=0, limit: int=50) → tuple[list[AuditLog], int]: applies all filter criteria and returns paginated results with total count. For post_lock_only filter: join with GoalEvent table where event_type=GOAL_LOCKED and changed_at > that event's occurred_at.

get_by_record(table_name: str, record_id: UUID) → list[AuditLog]: all audit entries for a specific record

CYCLE REPOSITORY (app/repositories/cycle_repository.py):
Extends BaseRepository for CycleConfig model. Add:

get_active() → CycleConfig or None: returns the single row where is_active=True. Returns None if no active window.

get_active_or_raise() → CycleConfig: calls get_active(), raises CycleNotFoundError if None

get_by_phase(phase: CyclePhase) → list[CycleConfig]: all configs for a given phase across all cycles

activate(cycle_id: UUID, db: AsyncSession) → CycleConfig: sets is_active=True for the given record AND sets is_active=False for all other records of the same phase. Atomic operation within a single flush.

get_all_for_cycle(cycle_name: str) → list[CycleConfig]: all 5 phase windows for a given cycle name

SHARED GOAL REPOSITORY (app/repositories/shared_goal_repository.py):
Extends BaseRepository for SharedGoal model. Add:

get_recipients(source_goal_id: UUID) → list[SharedGoal]: all recipients for a shared KPI

get_by_recipient(recipient_user_id: UUID, cycle_id: UUID) → list[SharedGoal]: all shared goals received by an employee in a cycle

is_already_pushed(source_goal_id: UUID, recipient_user_id: UUID) → bool: checks UniqueConstraint to prevent duplicate push

---

## PROMPT B6 — Services Layer (Business Logic)

Build all service classes. Services contain all business logic. They call repositories for data, enforce rules, fire events, and return results. No HTTP concerns here — just pure Python logic.

RBAC SERVICE (app/services/rbac_service.py):
RBACService class. At module level, load the RBAC_MATRIX from constants into memory once.

has_permission(role: UserRole, permission: Permission) → bool: checks if the role has the given permission in the in-memory matrix. O(1) lookup using sets, not lists.

get_permissions(role: UserRole) → list[Permission]: returns all permissions for a role

require_permission(role: UserRole, permission: Permission) → None: calls has_permission, raises ForbiddenError if False. Used by the API dependency layer.

Export a singleton instance: rbac_service = RBACService()

GOAL STATE MACHINE (app/services/goal_state_machine.py):
GoalStateMachine class. This is the single authority for all goal status transitions.

Define ALLOWED_TRANSITIONS as a dictionary mapping each GoalStatus to the list of GoalStatus values it can transition to:
- DRAFT → [SUBMITTED]
- SUBMITTED → [UNDER_REVIEW, DRAFT]  (DRAFT = returned for rework)
- UNDER_REVIEW → [APPROVED, DRAFT]
- APPROVED → [LOCKED]
- LOCKED → [UNDER_REVIEW]  (Admin unlock)
- ARCHIVED → []  (terminal state)

Define ACTOR_PERMISSIONS mapping each transition to which role can trigger it:
- DRAFT → SUBMITTED: employee (SUBMIT_GOAL_SHEET)
- SUBMITTED → UNDER_REVIEW: manager (APPROVE_GOAL or REJECT_GOAL)
- SUBMITTED → DRAFT: manager (RETURN_FOR_REWORK)
- UNDER_REVIEW → APPROVED: manager (APPROVE_GOAL)
- UNDER_REVIEW → DRAFT: manager (RETURN_FOR_REWORK)
- APPROVED → LOCKED: system (automatic, triggered by approval)
- LOCKED → UNDER_REVIEW: admin (UNLOCK_GOAL)

can_transition(current_status: GoalStatus, target_status: GoalStatus) → bool

transition(goal: Goal, target_status: GoalStatus, actor: User) → Goal:
  1. Check can_transition — raise InvalidStateTransitionError if not allowed
  2. Check actor has the required permission — raise ForbiddenError if not
  3. Set goal.status = target_status
  4. If target_status is LOCKED: set goal.locked_at and goal.locked_by
  5. Increment goal.version by 1
  6. Return modified goal (not yet flushed — caller flushes)

Export a singleton: goal_state_machine = GoalStateMachine()

VERSION SERVICE (app/services/version_service.py):
VersionService class.

snapshot_goal(goal: Goal, changed_by: User, change_reason: str or None, db: AsyncSession) → GoalVersion:
Creates an immutable snapshot of the goal's current state into the goal_versions table.
Use goal.version as the version_number.
Flush after creating. Return the version object.

get_versions(goal_id: UUID, db: AsyncSession) → list[GoalVersion]: fetches all versions for a goal ordered by version_number ascending.

get_diff(version_a: GoalVersion, version_b: GoalVersion) → dict: compares two versions field by field and returns a dict of {field: {from: old, to: new}} for every field that changed. Used by the version history UI.

Export a singleton: version_service = VersionService()

AUDIT SERVICE (app/services/audit_service.py):
AuditService class. Wraps AuditRepository with higher-level methods.

log_create(table_name, record_id, actor: User, db: AsyncSession, request_id: str or None = None) → None: logs an INSERT action. Never raises — wraps in try/except and logs the error if the audit write itself fails (audit must never break the main flow).

log_update(table_name, record_id, actor: User, field_name, old_value, new_value, db: AsyncSession, request_id: str or None = None) → None: logs an UPDATE action for a single field change.

log_goal_changes(old_goal: dict, new_goal: Goal, actor: User, db: AsyncSession, request_id: str or None = None) → None: compares old snapshot dict to new goal state, calls log_update for each changed field. Use this when a manager edits a goal.

get_audit_log(filters: AuditFilter, skip: int, limit: int, db: AsyncSession) → tuple[list[AuditLog], int]: delegates to audit_repository with actor names populated.

Export a singleton: audit_service = AuditService()

NOTIFICATION SERVICE (app/services/notification_service.py):
NotificationService class.

create_in_app(recipient_id: UUID, notification_type: NotificationType, title: str, body: str, db: AsyncSession, deep_link: str or None = None, related_goal_id: UUID or None = None) → Notification: creates a Notification record and flushes. Never raises — wraps in try/except.

get_for_user(user_id: UUID, skip: int, limit: int, db: AsyncSession) → list[Notification]: returns paginated notifications for a user, newest first.

get_unread_count(user_id: UUID, db: AsyncSession) → int: count of unread notifications.

mark_read(notification_id: UUID, user_id: UUID, db: AsyncSession) → Notification: marks one notification as read, validates it belongs to the user.

mark_all_read(user_id: UUID, db: AsyncSession) → int: marks all as read, returns count updated.

Export a singleton: notification_service = NotificationService()

CYCLE SERVICE (app/services/cycle_service.py):
CycleService class.

get_active_window(db: AsyncSession) → CycleConfig or None: fetches active window from cycle_repository.

is_window_open(db: AsyncSession) → bool: returns True if an active window exists and current datetime is between window_open and window_close.

require_open_window(db: AsyncSession) → CycleConfig: raises WindowClosedError with message showing next window if no open window. Used as a guard in goal creation and submission.

get_window_status(db: AsyncSession) → dict: returns {is_open, phase, days_remaining, window_open, window_close, message} — used by the frontend status banner endpoint.

activate_window(cycle_id: UUID, actor: User, db: AsyncSession) → CycleConfig: calls cycle_repository.activate, logs audit, returns updated config.

create_window(data: dict, actor: User, db: AsyncSession) → CycleConfig: validates window dates, creates config, logs audit.

Export a singleton: cycle_service = CycleService()

GOAL SERVICE (app/services/goal_service.py):
GoalService class. This is the largest and most critical service.

create_goal(user: User, data: GoalCreate, db: AsyncSession) → Goal:
  1. Call cycle_service.require_open_window(db) — reject if window closed
  2. Count existing goals: count_goals_in_cycle(user.id, cycle_id) — raise GoalCountError if already 8
  3. Validate data.weightage >= 10 — raise MinWeightageError if not
  4. Get or create GoalSheet for this user + cycle
  5. Create Goal record with status=DRAFT
  6. Call version_service.snapshot_goal (version 1, change_reason="Initial creation")
  7. Log audit: INSERT on goals table
  8. Create GoalEvent: GOAL_CREATED
  9. Create in-app notification for the user: "Goal added to your sheet"
  10. Commit the transaction
  11. Return the created goal

validate_sheet(goal_sheet_id: UUID, db: AsyncSession) → ValidationResult:
  Runs all 4 validation rules and returns list of errors:
  - Rule 1: count of non-deleted goals in sheet — must be >= 1 and <= 8
  - Rule 2: sum of all goal weightages — must equal exactly 100.00
  - Rule 3: each individual goal weightage — must be >= 10.00
  - Rule 4: all goals must be in DRAFT status (none already submitted)
  Returns ValidationResult with is_valid bool and list of ValidationError objects.

submit_sheet(goal_sheet_id: UUID, user: User, db: AsyncSession) → GoalSheet:
  1. Fetch sheet with goals
  2. Verify sheet belongs to user
  3. Verify sheet is in DRAFT status
  4. Call validate_sheet — raise WeightageError with all validation errors if not valid
  5. Transition each goal: DRAFT → SUBMITTED via goal_state_machine.transition
  6. Snapshot each goal at new version
  7. Set goal_sheet.status = SUBMITTED, goal_sheet.submitted_at = now()
  8. Create GoalEvent: GOAL_SUBMITTED for each goal
  9. Log audit for sheet status change
  10. Send notification to the manager: "{employee_name} has submitted their goal sheet for review"
  11. Commit
  12. Return updated sheet

update_goal(goal_id: UUID, user: User, data: GoalUpdate, db: AsyncSession) → Goal:
  1. Fetch goal, verify it belongs to user
  2. Verify goal status is DRAFT — raise GoalLockedError otherwise
  3. Snapshot current state before changes (for diff)
  4. Apply changes to goal fields
  5. Increment goal.version
  6. Snapshot new version with change_reason="Employee edited draft"
  7. Log audit for each changed field
  8. Commit and return

delete_goal(goal_id: UUID, user: User, db: AsyncSession) → None:
  1. Fetch goal, verify it belongs to user
  2. Verify status is DRAFT
  3. Soft delete the goal
  4. Log audit: DELETE action
  5. Commit

get_my_sheet(user: User, cycle_id: UUID, db: AsyncSession) → GoalSheet or None:
  Fetch goal sheet with all goals and versions eagerly loaded.

get_or_create_sheet(user_id: UUID, cycle_id: UUID, db: AsyncSession) → GoalSheet:
  Fetch existing sheet or create a new DRAFT sheet if none exists.

Export a singleton: goal_service = GoalService()

APPROVAL SERVICE (app/services/approval_service.py):
ApprovalService class.

get_pending_approvals(manager: User, db: AsyncSession) → list[GoalSheet]:
  Fetch all SUBMITTED and UNDER_REVIEW sheets from employees in manager's team.
  Include eager loading of goals and employee info.
  Sort by submitted_at ascending (oldest first = FIFO queue).

approve_sheet(sheet_id: UUID, manager: User, db: AsyncSession) → GoalSheet:
  1. Fetch sheet with goals, verify it is SUBMITTED or UNDER_REVIEW
  2. Verify the sheet owner's manager_id == manager.id
  3. For each goal: transition SUBMITTED/UNDER_REVIEW → APPROVED via state machine
  4. For each goal: immediately transition APPROVED → LOCKED via state machine (auto-lock)
  5. For each goal: snapshot at new version (change_reason="Approved and locked by manager")
  6. Set goal_sheet.status = APPROVED, goal_sheet.approved_at = now(), goal_sheet.approved_by = manager.id
  7. Create GoalEvent: GOAL_APPROVED then GOAL_LOCKED for each goal
  8. Log audit for each status change
  9. Notify employee: "Your goal sheet has been approved by {manager_name}. All goals are now locked."
  10. Commit and return

return_for_rework(sheet_id: UUID, manager: User, reason: str, db: AsyncSession) → GoalSheet:
  1. Verify sheet is SUBMITTED or UNDER_REVIEW
  2. Verify manager owns this review
  3. For each goal: transition → DRAFT via state machine
  4. Snapshot each goal with change_reason = reason
  5. Set goal_sheet.status = DRAFT
  6. Increment goal_sheet.returned_count by 1
  7. Create GoalEvent: GOAL_RETURNED_FOR_REWORK with payload {reason: reason}
  8. Notify employee with the reason prominently in the notification body
  9. Commit and return

inline_edit_goal(goal_id: UUID, manager: User, data: ManagerGoalEdit, db: AsyncSession) → Goal:
  1. Fetch goal, verify it is in SUBMITTED or UNDER_REVIEW status
  2. Verify the goal's owner has manager_id == manager.id
  3. Verify manager has EDIT_GOAL_IN_REVIEW permission
  4. Capture old values for audit
  5. Apply only the allowed fields: target_value, target_date, weightage
  6. Increment goal.version
  7. Snapshot new version with change_reason = data.change_reason
  8. Log audit for each changed field: old value → new value
  9. Create GoalEvent: TARGET_EDITED_BY_MANAGER or WEIGHTAGE_EDITED_BY_MANAGER
  10. Re-validate total sheet weightage after edit — raise WeightageError if now invalid
  11. Commit and return updated goal

SHARED GOAL SERVICE (app/services/shared_goal_service.py):
SharedGoalService class.

push_to_employees(admin: User, data: SharedGoalPush, cycle_id: UUID, db: AsyncSession) → list[Goal]:
  1. Verify admin has PUSH_SHARED_GOAL permission
  2. Create a master goal record with is_shared=True, user_id=admin.id
  3. For each recipient_user_id:
     a. Verify user exists and is an employee
     b. Check they have fewer than 8 goals (raise if at limit)
     c. Create a linked goal record: copy title, thrust_area, uom_type, target_value, target_date from master. Set source_shared_goal_id = master goal id. Set weightage = data.suggested_weightage. Set is_shared=True.
     d. Get or create their GoalSheet, add the goal to it
     e. Create SharedGoal record linking source to recipient
     f. Create GoalEvent: SHARED_GOAL_RECEIVED for the recipient's goal
     g. Notify recipient: "A shared departmental KPI has been added to your goal sheet"
  4. Create GoalEvent: SHARED_GOAL_PUSHED on the master goal
  5. Log audit for all created records
  6. Commit and return list of all created recipient goals

unlock_goal(goal_id: UUID, admin: User, reason: str, db: AsyncSession) → Goal:
  1. Verify admin has UNLOCK_GOAL permission
  2. Fetch goal, verify it is LOCKED
  3. Transition LOCKED → UNDER_REVIEW via state machine (admin bypasses normal permission check for this transition — admin can always unlock)
  4. Snapshot at new version with change_reason = "Admin unlock: " + reason
  5. Create GoalEvent: GOAL_UNLOCKED with payload {reason: reason, unlocked_by: admin.id}
  6. Log audit: this is a post-lock change — must be recorded
  7. Notify both the employee and their manager about the unlock
  8. Commit and return

REPORT SERVICE (app/services/report_service.py):
ReportService class.

get_org_stats(db: AsyncSession) → OrgStatsResponse: computes org-wide completion statistics from goal sheets and users tables.

get_completion_by_department(db: AsyncSession) → list[OrgCompletionSummary]: groups stats by department.

get_goal_report(filters: dict, skip: int, limit: int, db: AsyncSession) → tuple[list[GoalReportRow], int]: builds the achievement report rows from goals + users + departments joins.

generate_csv_content(rows: list[GoalReportRow]) → str: converts report rows to CSV string using Python's csv module. Returns the raw CSV string.

Export a singleton: report_service = ReportService()

---

## PROMPT B7 — Event Bus & Event Handlers

Build the in-process event system that decouples side effects (audit logging, notifications) from core business logic.

EVENT BUS (app/events/event_bus.py):
Build a simple synchronous in-process event bus (not Celery, not Redis — just Python). This is for hackathon scope.

EventBus class:
- handlers: dict mapping event_type string to list of handler callables
- subscribe(event_type: str, handler: callable) → None: registers a handler for an event type
- publish(event_type: str, event_data: dict) → None: calls all registered handlers for the event type sequentially. Wrap each handler call in try/except — if a handler fails, log the error but continue calling other handlers. The event bus must NEVER raise an exception to the caller.
- publish_async(event_type: str, event_data: dict, db: AsyncSession) → None: same but handlers receive the db session for database operations

EventBus should be a singleton. Export: event_bus = EventBus()

GOAL EVENTS (app/events/goal_events.py):
Define dataclasses or TypedDicts for each event payload:
- GoalCreatedEvent: goal_id, user_id, user_name, cycle_id, occurred_at
- GoalSubmittedEvent: goal_sheet_id, user_id, user_name, manager_id, goal_count, occurred_at
- GoalApprovedEvent: goal_sheet_id, employee_id, employee_name, manager_id, manager_name, occurred_at
- GoalReturnedEvent: goal_sheet_id, employee_id, employee_name, manager_id, reason, occurred_at
- GoalLockedEvent: goal_id, user_id, locked_by, locked_at, occurred_at
- GoalUnlockedEvent: goal_id, user_id, admin_id, reason, occurred_at
- ManagerGoalEditedEvent: goal_id, field_changed, old_value, new_value, manager_id, reason, occurred_at
- SharedGoalPushedEvent: source_goal_id, admin_id, recipient_ids, occurred_at

AUDIT HANDLER (app/events/handlers/audit_handler.py):
AuditHandler class that subscribes to all goal events and writes to the audit_log table.

register(event_bus: EventBus, db_factory: callable) → None: subscribes all handlers to the event bus.

handle_goal_submitted(event_data: dict, db: AsyncSession) → None: logs the sheet submission as an INSERT-level audit event.

handle_goal_approved(event_data: dict, db: AsyncSession) → None: logs approval with manager info.

handle_goal_returned(event_data: dict, db: AsyncSession) → None: logs return with reason.

handle_goal_locked(event_data: dict, db: AsyncSession) → None: logs the lock event — important for the "post-lock changes" audit filter.

handle_goal_unlocked(event_data: dict, db: AsyncSession) → None: logs unlock with admin id and reason.

Important: the audit handler must never raise exceptions. It is a side effect — the main transaction has already committed by the time this runs.

NOTIFICATION HANDLER (app/events/handlers/notification_handler.py):
NotificationHandler class that subscribes to events and creates in-app notifications.

handle_goal_submitted(event_data: dict, db: AsyncSession) → None: creates notification for the manager.

handle_goal_approved(event_data: dict, db: AsyncSession) → None: creates notification for the employee.

handle_goal_returned(event_data: dict, db: AsyncSession) → None: creates notification for employee with reason in the body.

handle_goal_unlocked(event_data: dict, db: AsyncSession) → None: creates notifications for both employee and manager.

handle_shared_goal_pushed(event_data: dict, db: AsyncSession) → None: creates notification for each recipient.

All handlers: never raise, wrap in try/except, log errors.

Register all handlers in a setup_handlers() function that is called from main.py on startup.

---

## PROMPT B8 — API Dependency Injection & Middleware

Build the FastAPI dependency injection system and middleware stack.

API DEPENDENCIES (app/api/deps.py):
This file is the bridge between HTTP requests and the service/repository layer.

get_db() → AsyncGenerator[AsyncSession, None]:
Yields a database session from AsyncSessionLocal. Ensures session.close() in finally block. This is the primary database dependency injected into every endpoint.

get_current_user(token: str from OAuth2PasswordBearer header, db: AsyncSession from get_db) → User:
  1. Extract token from Authorization: Bearer header
  2. Call security.decode_token(token) — raises 401 if invalid/expired
  3. Extract user_id from token payload sub field
  4. Fetch user from database by id
  5. Verify user is active (is_active=True and is_deleted=False) — raise 401 if not
  6. Return the User model instance

require_permission(permission: Permission) — returns a dependency factory:
This is a higher-order function that returns a FastAPI Depends callable.
Usage in endpoints: current_user: User = Depends(require_permission(Permission.APPROVE_GOAL))
The returned dependency calls get_current_user first, then checks rbac_service.has_permission(user.role, permission), raises ForbiddenError if denied.

get_current_active_employee(current_user: User from get_current_user) → User:
Raises ForbiddenError if user.role != EMPLOYEE. Convenience shortcut.

get_current_manager(current_user: User) → User:
Raises ForbiddenError if user.role not in [MANAGER, ADMIN].

get_current_admin(current_user: User) → User:
Raises ForbiddenError if user.role != ADMIN.

get_pagination(page: int query param default 1, page_size: int query param default 20, max_size: int=100) → PaginationParams:
Validates page >= 1 and page_size between 1 and max_size. Returns PaginationParams(skip=(page-1)*page_size, limit=page_size, page=page).

get_request_id(request: Request) → str:
Extracts X-Request-ID header if present, otherwise generates a new UUID. Used for request tracing through audit logs.

REQUEST ID MIDDLEWARE (app/middleware/request_id_middleware.py):
Starlette middleware that:
- On each request: reads X-Request-ID header, or generates a new UUID4 if absent
- Stores the request_id in request.state.request_id
- Adds X-Request-ID to the response headers
This allows correlating a single request across all log lines and audit entries.

LOGGING MIDDLEWARE (app/middleware/logging_middleware.py):
Starlette middleware that logs each request using structlog:
- Log on request start: method, path, user_agent, request_id
- Log on request end: method, path, status_code, duration_ms, user_id (from request.state if set), request_id
- Log all 5xx responses at ERROR level with the exception details
- Log 4xx responses at WARNING level
- Never log request/response bodies (security concern)

CORS CONFIGURATION:
In main.py, configure CORSMiddleware with:
- allow_origins = settings.cors_origins (from env)
- allow_credentials = True
- allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
- allow_headers = ["*"]
This allows the React frontend to make authenticated requests.

---

## PROMPT B9 — API Endpoints (Routes)

Build all FastAPI endpoint files. Every endpoint must be thin — no business logic here, only HTTP handling. Each endpoint: validates input (Pydantic does this), calls the appropriate service, and returns an APIResponse wrapped result.

MAIN APP (app/main.py):
Create the FastAPI application instance with:
- title="AtomQuest Goal Portal API", version="1.0.0", description with a brief explanation
- OpenAPI docs at /docs (disable in production via settings.environment check)
- Register all custom exception handlers from app/core/exceptions.py
- Add RequestIdMiddleware
- Add LoggingMiddleware
- Add CORSMiddleware
- On startup event: call configure_logging(), call init_db() only if ENVIRONMENT=development, call setup_handlers() for the event bus
- Mount the v1 router at prefix /api/v1
- Health check endpoint at GET /health returning {status: "healthy", version: app version, environment: settings.environment}

AUTH ENDPOINTS (app/api/v1/endpoints/auth.py):

POST /api/v1/auth/login:
- Request body: LoginRequest (email, password)
- Fetch user by email from user_repository
- If not found or password wrong: raise InvalidCredentialsError (do NOT distinguish between wrong email and wrong password — security best practice)
- If user is inactive: raise ForbiddenError "Account is deactivated. Contact HR Admin."
- Create access_token and refresh_token with user_id, role, permissions list in payload
- Return TokenResponse with both tokens and full UserResponse
- Log the successful login in audit log

POST /api/v1/auth/refresh:
- Request body: RefreshRequest (refresh_token)
- Decode the refresh token, verify type is "refresh"
- Issue new access_token (do NOT issue a new refresh_token here — only rotate on explicit logout+login)
- Return new TokenResponse

POST /api/v1/auth/logout:
- Request body: LogoutRequest (refresh_token)
- Decode the token to get user info
- For now, simply return success (token blacklisting requires Redis — document this as a production enhancement)
- Return success message

GET /api/v1/auth/me:
- Requires authentication (get_current_user dependency)
- Returns full UserResponse for the current user including permissions list
- This is called by the frontend on every page load to validate session

USER ENDPOINTS (app/api/v1/endpoints/users.py):

GET /api/v1/users/:
- Requires ADMIN role
- Query params: role (optional), department_id (optional), page, page_size
- Returns paginated list of UserListResponse

POST /api/v1/users/:
- Requires ADMIN role
- Request body: UserCreate
- Hash the password, create user
- Seed the default permissions for the role (by inserting into role_permissions if not already seeded)
- Log audit: INSERT on users table
- Return UserResponse

GET /api/v1/users/{user_id}:
- Requires authentication
- Employee can only fetch their own profile
- Manager can fetch their own and their direct reports' profiles
- Admin can fetch anyone
- Return UserResponse

PATCH /api/v1/users/{user_id}:
- Requires ADMIN role
- Request body: UserUpdate (partial)
- Log audit for each changed field
- Return updated UserResponse

GET /api/v1/users/me/team:
- Requires MANAGER or ADMIN role
- Returns list of direct reports for the current user
- Includes each person's current goal sheet status

GOAL ENDPOINTS (app/api/v1/endpoints/goals.py):

POST /api/v1/goals/:
- Requires CREATE_GOAL permission
- Body: GoalCreate
- Calls goal_service.create_goal
- Returns APIResponse[GoalResponse]

GET /api/v1/goals/my-sheet:
- Requires authentication
- Gets or returns None for the current cycle's goal sheet
- Returns APIResponse[GoalSheetResponse] with all goals included
- Also returns total_weightage, validation_status (from validate_sheet), days_remaining in window

PUT /api/v1/goals/{goal_id}:
- Requires EDIT_OWN_DRAFT_GOAL permission
- Body: GoalUpdate
- Calls goal_service.update_goal
- Returns APIResponse[GoalResponse]

DELETE /api/v1/goals/{goal_id}:
- Requires EDIT_OWN_DRAFT_GOAL permission
- Calls goal_service.delete_goal
- Returns APIResponse with success message

POST /api/v1/goals/submit-sheet:
- Requires SUBMIT_GOAL_SHEET permission
- Body: {sheet_id: UUID}
- Calls goal_service.submit_sheet
- Returns APIResponse[GoalSheetResponse]

GET /api/v1/goals/team:
- Requires VIEW_TEAM_GOALS permission
- Query params: cycle_id (optional), status (optional), page, page_size
- Returns all goals of all direct reports
- Returns APIResponse[PaginatedData[GoalResponse]]

GOAL VERSION ENDPOINTS (app/api/v1/endpoints/goal_versions.py):

GET /api/v1/goals/{goal_id}/versions:
- Requires authentication
- Employee: can only fetch versions of their own goals
- Manager: can fetch versions of their team's goals
- Admin: can fetch any
- Returns APIResponse[list[GoalVersionResponse]] ordered by version_number ascending

APPROVAL ENDPOINTS (inside goals.py or separate approvals.py):

GET /api/v1/approvals/pending:
- Requires APPROVE_GOAL permission
- Returns paginated list of GoalSheetResponse objects awaiting review
- Includes days_waiting computed field

GET /api/v1/approvals/{sheet_id}:
- Requires APPROVE_GOAL permission
- Returns full GoalSheetResponse with all goals and their version histories
- Verifies the sheet belongs to one of the manager's direct reports

POST /api/v1/approvals/{sheet_id}/approve:
- Requires APPROVE_GOAL permission
- Calls approval_service.approve_sheet
- Returns APIResponse[GoalSheetResponse]

POST /api/v1/approvals/{sheet_id}/return-for-rework:
- Requires RETURN_FOR_REWORK permission
- Body: {reason: str (min 20 chars)}
- Calls approval_service.return_for_rework
- Returns APIResponse[GoalSheetResponse]

PATCH /api/v1/approvals/{sheet_id}/goals/{goal_id}:
- Requires EDIT_GOAL_IN_REVIEW permission
- Body: ManagerGoalEdit
- Calls approval_service.inline_edit_goal
- Returns APIResponse[GoalResponse]

SHARED GOAL ENDPOINTS (app/api/v1/endpoints/shared_goals.py):

POST /api/v1/shared-goals/push:
- Requires PUSH_SHARED_GOAL permission (admin only)
- Body: SharedGoalPush
- Calls shared_goal_service.push_to_employees
- Returns APIResponse with list of created goal ids and recipient names

GET /api/v1/shared-goals/pushed:
- Requires ADMIN role
- Returns all shared goals that admin has pushed with recipient details

POST /api/v1/admin/goals/{goal_id}/unlock:
- Requires UNLOCK_GOAL permission (admin only)
- Body: {reason: str (min 30 chars)}
- Calls shared_goal_service.unlock_goal
- Returns APIResponse[GoalResponse]

ADMIN ENDPOINTS (app/api/v1/endpoints/admin.py):

GET /api/v1/admin/cycles:
- Requires CONFIGURE_CYCLE permission
- Returns all cycle configs grouped by cycle_name

POST /api/v1/admin/cycles:
- Requires CONFIGURE_CYCLE permission
- Body: {cycle_name, phase, window_open, window_close}
- Validates window_open < window_close
- Calls cycle_service.create_window
- Returns APIResponse[CycleConfig]

PATCH /api/v1/admin/cycles/{cycle_id}:
- Requires CONFIGURE_CYCLE permission
- Body: {window_open, window_close} — both optional
- Validates the updated dates
- Returns APIResponse[CycleConfig]

POST /api/v1/admin/cycles/{cycle_id}/activate:
- Requires CONFIGURE_CYCLE permission
- Calls cycle_service.activate_window
- Returns APIResponse[CycleConfig]

GET /api/v1/admin/cycles/active:
- Public endpoint (no auth required — frontend needs this for the banner)
- Returns the current window status: {is_open, phase, days_remaining, window_open, window_close, message}

REPORT ENDPOINTS (app/api/v1/endpoints/reports.py):

GET /api/v1/reports/goals:
- Requires EXPORT_REPORTS permission
- Query params: department_id, manager_id, status, page, page_size
- Returns paginated GoalReportRow list

GET /api/v1/reports/goals/export:
- Requires EXPORT_REPORTS permission
- Same filters as above
- Returns StreamingResponse with Content-Type: text/csv and Content-Disposition: attachment; filename="goal_report_FY2026.csv"
- Uses report_service.generate_csv_content

GET /api/v1/reports/org-stats:
- Requires ADMIN role
- Returns OrgStatsResponse with completion percentages

AUDIT ENDPOINTS (app/api/v1/endpoints/audit.py):

GET /api/v1/audit-logs:
- Requires VIEW_AUDIT_LOG permission
- Query params from AuditFilter: date_from, date_to, actor_id, table_name, action, post_lock_only, page, page_size
- Returns paginated AuditLogResponse list with actor names populated

NOTIFICATION ENDPOINTS (app/api/v1/endpoints/notifications.py):

GET /api/v1/notifications:
- Requires authentication
- Returns paginated notifications for current user, newest first

GET /api/v1/notifications/unread-count:
- Requires authentication
- Returns {count: int}
- This endpoint will be polled by frontend every 30 seconds

PATCH /api/v1/notifications/{notification_id}/read:
- Requires authentication
- Marks one notification as read for current user
- Returns updated notification

POST /api/v1/notifications/mark-all-read:
- Requires authentication
- Returns {updated_count: int}

V1 ROUTER (app/api/v1/router.py):
Mount all endpoint routers under /api/v1 with appropriate tags for OpenAPI grouping:
- auth router: tag "Authentication"
- goals router: tag "Goals"
- goal_versions router: tag "Goal History"
- shared_goals router: tag "Shared Goals"
- users router: tag "Users"
- admin router: tag "Admin"
- reports router: tag "Reports"
- audit router: tag "Audit"
- notifications router: tag "Notifications"

---

## PROMPT B10 — Alembic Migrations & Database Seed Script

Set up Alembic for database migrations and create the complete seed script that populates the database with demo data.

ALEMBIC SETUP:
Run "alembic init migrations" inside the backend directory to generate the Alembic scaffold.

Configure migrations/env.py to:
- Import all models from app/models/__init__.py so Alembic auto-detects them
- Use the async SQLAlchemy engine configuration
- Read DATABASE_URL from settings (not hardcoded)
- Set target_metadata = Base.metadata
- Configure the run_migrations_online function to use the async engine pattern for asyncpg

Configure alembic.ini:
- Set script_location = migrations
- Set sqlalchemy.url to a placeholder (actual URL comes from env.py dynamically)

Create the following migration files in migrations/versions/ in this exact order:

001_create_departments_and_users.py:
- Create departments table first (no FK dependencies)
- Create users table with self-referential manager_id FK and department_id FK
- Create index on users.email and users.is_deleted
- Create index on users.manager_id

002_create_cycle_config.py:
- Create cycle_configs table

003_create_goal_sheets_and_goals.py:
- Create goal_sheets table (depends on users and cycle_configs)
- Create goals table (depends on users, goal_sheets, cycle_configs, self-referential source_shared_goal_id)
- Create all indexes: user_id+cycle_id, goal_sheet_id, status

004_create_goal_versions_and_events.py:
- Create goal_versions table (depends on goals, users) — immutable, no is_deleted
- Create goal_events table (depends on goals, users) — immutable

005_create_shared_goals.py:
- Create shared_goals table (depends on goals, users)
- Create UniqueConstraint on source_goal_id + recipient_user_id

006_create_audit_logs.py:
- Create audit_logs table — immutable, no is_deleted or updated_at
- Create indexes on table_name+record_id, actor_id, changed_at

007_create_notifications.py:
- Create notifications table (depends on users, goals)
- Create index on recipient_id + is_read

008_create_role_permissions.py:
- Create role_permissions table
- Insert all default permission rows from the RBAC_MATRIX constant — all 15 permission assignments for all 3 roles seeded here as part of the migration

Each migration file must have both upgrade() and downgrade() functions. downgrade() must drop tables in reverse dependency order.

SEED SCRIPT (scripts/seed_data.py):
Create a Python script that can be run standalone with "python scripts/seed_data.py". It must:

Step 1 — Create departments:
- Sales Department
- Operations Department
- HR Department
- Engineering Department

Step 2 — Create users (use hash_password from security module):

Admin user:
- Name: Priya Sharma, Email: priya@atomberg.com, Password: Admin@1234, Role: ADMIN, Dept: HR, Code: ATB001

Manager 1:
- Name: Vikram Nair, Email: vikram@atomberg.com, Password: Manager@1234, Role: MANAGER, Dept: Sales, Code: ATB002, manager_id: Priya's id

Manager 2:
- Name: Kavya Reddy, Email: kavya@atomberg.com, Password: Manager@1234, Role: MANAGER, Dept: Operations, Code: ATB003, manager_id: Priya's id

Employee 1:
- Name: Rahul Verma, Email: rahul@atomberg.com, Password: Employee@1234, Role: EMPLOYEE, Dept: Sales, Code: ATB004, manager_id: Vikram's id

Employee 2:
- Name: Sneha Patel, Email: sneha@atomberg.com, Password: Employee@1234, Role: EMPLOYEE, Dept: Sales, Code: ATB005, manager_id: Vikram's id

Employee 3:
- Name: Arjun Mehta, Email: arjun@atomberg.com, Password: Employee@1234, Role: EMPLOYEE, Dept: Operations, Code: ATB006, manager_id: Kavya's id

Employee 4:
- Name: Divya Singh, Email: divya@atomberg.com, Password: Employee@1234, Role: EMPLOYEE, Dept: Operations, Code: ATB007, manager_id: Kavya's id

Step 3 — Create active cycle config:
- Cycle name: FY2026
- Phase: GOAL_SETTING
- Window open: May 1 2026 00:00:00 UTC
- Window close: May 31 2026 23:59:59 UTC
- is_active: True
- created_by: Priya's id

Step 4 — Create goal sheet and goals for Rahul (status: LOCKED — already approved):
Create a GoalSheet with status=APPROVED for Rahul in FY2026 cycle.
Create 5 goals all with status=LOCKED:
1. Title: "Achieve Q1 Sales Revenue Target", Thrust: REVENUE_GROWTH, UoM: MIN, Target: 5000000 (50 lakhs), Weightage: 30%
2. Title: "Reduce Customer Response TAT", Thrust: CUSTOMER_SATISFACTION, UoM: MAX, Target: 2, Weightage: 25%
3. Title: "Complete Product Certification Program", Thrust: PEOPLE_DEVELOPMENT, UoM: TIMELINE, Target date: June 30 2026, Weightage: 20%
4. Title: "Zero Safety Incidents in Sales Field Visits", Thrust: SAFETY_COMPLIANCE, UoM: ZERO, Target: 0, Weightage: 15%
5. Title: "Onboard 3 New Enterprise Accounts", Thrust: REVENUE_GROWTH, UoM: MIN, Target: 3, Weightage: 10%
Create GoalVersion snapshots for each goal at version 1.
Create GoalEvent: GOAL_LOCKED for each.

Step 5 — Create goal sheet for Sneha (status: SUBMITTED — awaiting approval):
Create a GoalSheet with status=SUBMITTED for Sneha.
Create 4 goals all with status=SUBMITTED:
1. Title: "Q1 New Customer Acquisition", Thrust: REVENUE_GROWTH, UoM: MIN, Target: 10, Weightage: 35%
2. Title: "Achieve NPS Score Target", Thrust: CUSTOMER_SATISFACTION, UoM: MIN, Target: 8, Weightage: 30%
3. Title: "Reduce Sales Cycle Length", Thrust: OPERATIONAL_EXCELLENCE, UoM: MAX, Target: 14, Weightage: 25%
4. Title: "Complete Sales Training Modules", Thrust: PEOPLE_DEVELOPMENT, UoM: TIMELINE, Target date: July 31 2026, Weightage: 10%

Step 6 — Create a draft goal sheet for Arjun (status: DRAFT — still working):
Create a GoalSheet with status=DRAFT for Arjun.
Create 2 draft goals:
1. Title: "Improve Production Line Efficiency", Thrust: OPERATIONAL_EXCELLENCE, UoM: MIN, Target: 95, Weightage: 60% (intentionally invalid — shows validation in action)
2. Title: "Zero Quality Defects in Q1", Thrust: QUALITY, UoM: ZERO, Target: 0, Weightage: 30%
Total weightage: 90% — not yet 100%, so submit is blocked. Good for demo.

Step 7 — Create sample audit log entries:
Create 10 realistic audit log entries reflecting the above activity:
- Rahul's goal sheet submitted (INSERT on goal_sheets)
- Each of Rahul's goals approved (UPDATE on goals, field status, old SUBMITTED new APPROVED)
- Each of Rahul's goals locked (UPDATE on goals, field status, old APPROVED new LOCKED)
- Vikram edited Rahul's goal 1 target from 4500000 to 5000000 (UPDATE on goals, field target_value)
- Sneha's goal sheet submitted

Step 8 — Create sample notifications:
- For Vikram: "Sneha Patel has submitted her goal sheet for review" (unread)
- For Rahul: "Your goal sheet has been approved by Vikram Nair" (read)
- For Vikram: "Arjun Mehta has not submitted goals — 12 days since window opened" (unread)

Print a summary at the end: "Seed complete. Created N users, N goals, N audit entries."

RESET SCRIPT (scripts/reset_db.py):
Simple script that drops all tables and re-runs seed_data.py. Only for development use. Must print a warning and require confirmation input before executing.

---

## PROMPT B11 — Utils, Validators & Final Integration

Build all utility functions, run the final integration checks, and ensure everything works together.

PAGINATION UTILITY (app/utils/pagination.py):
PaginationParams dataclass: skip (int), limit (int), page (int), page_size (int)
paginate_query(query, skip, limit) → applies offset and limit to an SQLAlchemy query
build_pagination_meta(total: int, page: int, page_size: int) → PaginationMeta

DATE UTILITIES (app/utils/date_utils.py):
quarter_from_date(date) → CyclePhase: returns which quarter a date falls in based on the standard schedule (Q1=July, Q2=October, Q3=January, Q4=April)
is_in_window(window_open: datetime, window_close: datetime) → bool: checks if now() is between the two datetimes
days_until_close(window_close: datetime) → int: returns number of days remaining (negative if past)
format_window_message(cycle: CycleConfig) → str: returns human-readable status like "Goal Setting Window closes in 12 days (31 May 2026)"

EXPORT UTILITIES (app/utils/export_utils.py):
dict_to_csv(rows: list[dict], fieldnames: list[str]) → str: converts a list of dicts to CSV string using Python's csv.DictWriter
generate_csv_streaming_response(content: str, filename: str) → StreamingResponse: wraps the CSV string in a FastAPI StreamingResponse with proper headers

VALIDATORS (app/utils/validators.py):
validate_weightage_sum(goals: list) → ValidationResult: checks sum equals exactly 100.00 using Decimal arithmetic (not float — float has precision errors with percentages)
validate_goal_count(count: int) → ValidationResult: checks 1 <= count <= 8
validate_min_weightage(weightage: Decimal) → ValidationResult: checks >= 10.00
validate_all_draft(goals: list) → ValidationResult: checks all goals are in DRAFT status
run_sheet_validations(goals: list) → list[ValidationResult]: runs all 4 validators and returns combined list of failures

FINAL INTEGRATION STEPS:

1. Create a .env file from .env.example with real local values for DATABASE_URL and a generated SECRET_KEY. Add .env to .gitignore.

2. Run Alembic migrations: "alembic upgrade head" — all 8 migrations must complete without error.

3. Run the seed script: "python scripts/seed_data.py" — must complete and print the success summary.

4. Start the server: "uvicorn app.main:app --reload --port 8000" — must start without errors.

5. Verify the following endpoints return correct responses (test with curl or the FastAPI /docs):
   - GET /health → {status: "healthy"}
   - GET /api/v1/admin/cycles/active → active window data
   - POST /api/v1/auth/login with {email: "rahul@atomberg.com", password: "Employee@1234"} → returns access_token and user data
   - GET /api/v1/goals/my-sheet with Bearer token from login → returns Rahul's 5 locked goals
   - POST /api/v1/auth/login with {email: "vikram@atomberg.com", password: "Manager@1234"} → manager token
   - GET /api/v1/approvals/pending with manager token → returns Sneha's submitted sheet
   - POST /api/v1/auth/login with {email: "priya@atomberg.com", password: "Admin@1234"} → admin token
   - GET /api/v1/audit-logs with admin token → returns seeded audit entries

6. Open /docs in browser — verify all endpoints appear with correct schemas, all required fields marked, and example values shown.

7. Check CORS: make a request from http://localhost:5173 (frontend dev server) — must not be blocked.

8. Verify error responses match the standard format: {success: false, data: null, error: {code, message, field}, meta: null}

9. Test one rejection scenario: attempt POST /api/v1/goals/ with rahul's token but with weightage: 5 (below 10% minimum) → must return 422 with MinWeightageError code.

10. Test the RBAC: attempt GET /api/v1/audit-logs with Rahul's employee token → must return 403 with ForbiddenError.

Fix any failures before proceeding. The backend is considered complete for Phase 1 when all 10 checks pass.

---

## Demo Credentials Summary

| Role     | Email                   | Password       |
|----------|-------------------------|----------------|
| Admin    | priya@atomberg.com      | Admin@1234     |
| Manager  | vikram@atomberg.com     | Manager@1234   |
| Manager  | kavya@atomberg.com      | Manager@1234   |
| Employee | rahul@atomberg.com      | Employee@1234  |
| Employee | sneha@atomberg.com      | Employee@1234  |
| Employee | arjun@atomberg.com      | Employee@1234  |
| Employee | divya@atomberg.com      | Employee@1234  |

## Phase 1 Backend — Definition of Done

The backend is ready to wire to the frontend when ALL of the following are true:
- [ ] All 8 Alembic migrations run cleanly on a fresh database
- [ ] Seed script creates all users, goals, audit entries without errors
- [ ] All 3 role logins return valid JWT tokens with correct permissions
- [ ] Employee can create, edit, delete draft goals and submit the sheet
- [ ] Manager can view pending approvals, inline edit, approve, and return for rework
- [ ] Admin can configure cycle windows, push shared goals, unlock goals, view audit trail
- [ ] All validation rules enforced at the service layer (not just frontend)
- [ ] All endpoints return responses in the standard APIResponse envelope
- [ ] RBAC enforced: wrong role gets 403 on all protected endpoints
- [ ] Audit log records every significant action
- [ ] In-app notifications created for all key events
- [ ] CSV export endpoint streams a valid downloadable CSV
- [ ] /docs shows all endpoints with correct schema documentation
- [ ] CORS allows requests from the frontend origin
