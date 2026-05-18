# AtomQuest Goal Portal

An enterprise-grade goal management and quarterly performance tracking platform built for the AtomQuest Hackathon 2026. Modelled after Workday/SAP SuccessFactors — every action is an event, every change is versioned, every rule is enforced at the service layer.

**Live URL:** [https://atom-quest-pink.vercel.app/](https://atom-quest-pink.vercel.app/)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker Compose](#docker-compose)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [RBAC — Role Permissions](#rbac--role-permissions)
- [Scoring Formulas](#scoring-formulas)
- [Good-to-Have Features](#good-to-have-features)

---

## Overview

AtomQuest Goal Portal is a full-stack web application that manages the complete employee performance cycle — from goal creation and approval through quarterly achievement tracking and manager check-ins.

The system supports three roles (Employee, Manager, Admin) with a strict state-machine-enforced goal lifecycle, an immutable audit trail, and a CQRS-lite analytics projection. It is built to enterprise standards: every mutation fires a domain event, every state change is versioned, and no record is ever hard-deleted.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI), TanStack Query, Zustand, React Hook Form + Zod, Recharts |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic, Pydantic v2, structlog |
| **Database** | PostgreSQL (Neon — serverless managed) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing, Azure AD SSO (OAuth2) |
| **Deployment** | Vercel (frontend), Railway (backend Docker), Neon (database) |

---

## Architecture

```
                 HTTPS                         HTTPS / asyncpg (SSL)
  ┌──────────┐  ───────►  ┌─────────────────┐  ───────►  ┌──────────────┐
  │ Browser  │            │ Backend (API)   │            │  Neon        │
  │ Vercel   │  ◄───────  │ Railway (Docker)│  ◄───────  │  Postgres    │
  │ React SPA│   JSON     │ FastAPI/uvicorn │   rows     │  (serverless)│
  └──────────┘            └─────────────────┘            └──────────────┘
   VITE_API_URL ───────────────► /api/v1/...
```

**Key architectural decisions:**

- **Modular Monolith + Event-Driven Side Effects** — Services fire domain events; independent handlers (Audit, Notification, Snapshot) subscribe to them. Adding a new side effect = one new handler class, zero changes to existing services.
- **State Machine** — Goal lifecycle (`draft → submitted → under_review → approved → locked → archived`) is enforced by a central `GoalStateMachine` class. Invalid transitions are rejected at the service layer, not the UI.
- **Immutable Versioning (Temporal Data Management)** — Every goal state change writes a snapshot to `goal_versions`. Every achievement re-submission writes to `achievement_versions`. Nothing is ever overwritten — only appended.
- **CQRS Lite** — The analytics dashboard reads from `analytics_snapshots` (a pre-computed projection) updated synchronously by `SnapshotUpdateHandler` on every relevant event. Dashboards load in O(1) per user — one row read, not a 5-table JOIN.
- **Repository → Service → API layering** — Repositories own all DB queries; Services own all business rules; API endpoints own only HTTP in/out. No business logic in endpoints.
- **Database-driven RBAC** — Permissions are rows in `role_permissions`. Adding a new permission = one SQL insert. No code change required.

---

## Features

### Employee
- Create and manage goals (up to 8 per cycle, total weightage must equal 100%)
- Choose from 4 UoM types: `min` (lower is better), `max` (higher is better), `timeline` (date-based), `zero` (zero = success)
- Submit goal sheet to manager for approval
- Receive and act on rework requests
- Log quarterly achievement updates with computed scores
- Acknowledge manager check-ins
- View full goal version history and audit trail
- In-app notification bell with deep links

### Manager
- Approval queue — approve or return employee goal sheets with feedback
- Inline edit goal targets and weightage during review (creates a version snapshot)
- Conduct quarterly check-ins per employee with structured or free-form comments
- View team goals, achievement status, and overall completion
- Receive in-app and email notifications for submissions and acknowledgements

### Admin
- Configure performance cycles (phases, window open/close dates)
- Create and manage users + departments + org hierarchy (self-referential manager relationship)
- Push shared KPIs to selected employees (shared goals propagate achievements automatically)
- Unlock approved goals for revision with a reason
- Full audit trail with field-level change history and filters
- Achievement reports with CSV export
- Analytics dashboard powered by the CQRS snapshot table

---

## Project Structure

```
atomquest-portal/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app factory, middleware, router mount
│   │   ├── api/v1/endpoints/         # HTTP layer — auth, goals, achievements, checkins, admin, reports, audit, notifications
│   │   ├── core/                     # Config (Pydantic Settings), security (JWT/bcrypt), database, exceptions, logging
│   │   ├── models/                   # SQLAlchemy ORM models (User, Goal, GoalVersion, Achievement, Checkin, …)
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── services/                 # Business logic (GoalService, ScoringService, ApprovalService, CheckinService, …)
│   │   ├── repositories/             # DB query layer (BaseRepository, GoalRepository, UserRepository, …)
│   │   └── events/                   # EventBus + domain events + handlers (AuditHandler, NotificationHandler, SnapshotUpdateHandler)
│   ├── migrations/                   # Alembic migration files
│   ├── scripts/                      # Seed data, reset DB, smoke tests
│   ├── tests/                        # Unit and integration tests
│   ├── Dockerfile
│   ├── railway.json
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/                # AdminDashboard, PersonnelPage, CycleConfigPage, SharedGoalsPage, AuditTrailPage, ReportsPage, GoalUnlockPage
│   │   │   ├── manager/              # ManagerDashboard, ApprovalQueuePage, GoalReviewPage, TeamGoalsPage, CheckinModule
│   │   │   └── employee/             # EmployeeDashboard, MyGoals, GoalsPage, QuarterlyUpdate, CheckinsReceived
│   │   ├── components/               # Reusable UI components (shadcn/ui based)
│   │   ├── services/                 # API client, typed service functions
│   │   ├── store/                    # Zustand global state
│   │   ├── hooks/                    # Custom React hooks
│   │   └── types/                    # TypeScript type definitions
│   ├── Dockerfile
│   └── package.json
├── docs/                             # Build plans, API spec, deployment guide
├── docker-compose.yml
└── README.md
```

---

## Database Schema

### Core Tables (Phase 1)

| Table | Purpose |
|---|---|
| `users` | Employees, managers, admins with self-referential `manager_id` for org hierarchy |
| `departments` | Org units with a `head_user_id` |
| `goals` | Individual goals with UoM type, target, weightage, status, and optimistic locking via `version` column |
| `goal_sheets` | Container for all goals per employee per cycle — weightage validation at sheet level |
| `goal_versions` | Immutable snapshot of every goal state change (temporal data management) |
| `goal_events` | High-level business event log (GOAL_CREATED, GOAL_SUBMITTED, GOAL_APPROVED, …) |
| `audit_log` | Field-level change record (table, record_id, field, old_val, new_val, actor, IP) |
| `cycle_config` | Performance cycle phases with window open/close timestamps |
| `role_permissions` | Database-driven RBAC matrix — role + permission_key pairs |
| `shared_goals` | Admin-pushed KPIs linked to recipient employees |

### Phase 2 Tables

| Table | Purpose |
|---|---|
| `achievements` | Append-only quarterly achievement ledger per goal — one row per (goal, quarter) |
| `achievement_versions` | Immutable snapshot on every re-submission, with mandatory `edit_reason` |
| `checkins` | Manager-to-employee quarterly check-in record with acknowledgement flow |
| `checkin_events` | Business event log for check-in mutations |
| `analytics_snapshots` | CQRS read projection — pre-computed per-user per-quarter scores and completion stats |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (or local Postgres)

### Local Development

**Backend:**

```powershell
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
cd backend
pip install -r requirements.txt

# Copy and configure environment variables
copy .env.example .env   # then fill in DATABASE_URL, SECRET_KEY, etc.

# Run migrations
alembic upgrade head

# Seed demo data (optional)
python scripts/seed_data.py

# Start the API server
uvicorn app.main:app --reload --port 8080
```

API available at `http://localhost:8080` — interactive docs at `http://localhost:8080/docs` (development only).

**Frontend:**

```powershell
cd frontend
npm install
# Set VITE_API_URL=http://localhost:8080/api in .env.local
npm run dev
```

Frontend available at `http://localhost:5173`.

### Docker Compose

Builds and runs both services locally against the Neon database defined in `backend/.env`:

```powershell
# Default ports: backend=8000, frontend=5173
docker compose up --build

# Custom ports
$env:BACKEND_PORT="8080"; docker compose up --build
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon pooled URL recommended) |
| `DB_SSL` | ✅ | `true` for Neon/production |
| `SECRET_KEY` | ✅ | 64-hex random string for JWT signing |
| `ALGORITHM` | ✅ | JWT algorithm — `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ✅ | Default `480` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ✅ | Default `7` |
| `ENVIRONMENT` | ✅ | `development` / `staging` / `production` (disables `/docs` in production) |
| `CORS_ORIGINS` | ✅ | JSON array string, e.g. `["https://your-app.vercel.app"]` |
| `AZURE_CLIENT_ID` | ⬜ | Azure AD app client ID (for SSO) |
| `AZURE_TENANT_ID` | ⬜ | Azure AD tenant ID (for SSO) |
| `AZURE_CLIENT_SECRET` | ⬜ | Azure AD client secret (for SSO) |
| `AZURE_REDIRECT_URI` | ⬜ | OAuth2 callback URL |
| `FRONTEND_URL` | ⬜ | Used for SSO redirect after login |

Generate a strong secret key:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend base URL ending in `/api`, e.g. `https://backend.railway.app/api` |

---

## API Reference

Base path: `/api/v1`

Interactive docs (development/staging only): `/docs`

| Group | Endpoints |
|---|---|
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/azure/login`, `GET /auth/azure/callback` |
| **Goals** | `GET/POST /goals`, `GET/PUT/PATCH /goals/{id}`, `POST /goals/{id}/submit`, `POST /goals/{id}/approve`, `POST /goals/{id}/return` |
| **Goal Versions** | `GET /goals/{id}/versions` |
| **Achievements** | `POST /achievements`, `GET /achievements/{goal_id}/{quarter}`, `GET /achievements/my` |
| **Check-ins** | `POST /checkins`, `GET /checkins/my-team`, `GET /checkins/received`, `PATCH /checkins/{id}/acknowledge` |
| **Shared Goals** | `POST /shared-goals/push`, `GET /shared-goals` |
| **Users** | `GET /users`, `POST /users`, `GET /users/{id}`, `PATCH /users/{id}` |
| **Admin** | `GET/POST /admin/cycles`, `POST /admin/goals/{id}/unlock`, `GET /admin/org` |
| **Reports** | `GET /reports/achievements`, `GET /reports/completion-dashboard` |
| **Audit** | `GET /audit/logs` |
| **Notifications** | `GET /notifications`, `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all` |
| **Health** | `GET /health` |

Full OpenAPI spec: [`docs/api-spec.yaml`](docs/api-spec.yaml)

---

## Deployment

| Layer | Platform | Config file |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | `frontend/vercel.json` |
| Backend | [Railway](https://railway.app) | `backend/railway.json`, `backend/Dockerfile` |
| Database | [Neon](https://neon.tech) | Connection string via `DATABASE_URL` env var |

**Key deployment facts:**

1. The frontend reads `VITE_API_URL` at **build time**. It must end in `/api` — the client appends `/v1/...` to it automatically.
2. Migrations run automatically on every backend boot via `alembic upgrade head` in `backend/start.sh`. They are idempotent — safe to run on every deploy.
3. `CORS_ORIGINS` must be a JSON array string and must include the exact Vercel frontend domain.
4. Neon connection strings work as-is — the config layer strips Neon-only params (`sslmode`, `channel_binding`) before passing to asyncpg. Keep `DB_SSL=true`.
5. `/docs` and `/openapi.json` are disabled when `ENVIRONMENT=production`.

See [`docs/Deployment.md`](docs/Deployment.md) for the complete step-by-step deployment guide.

---

## RBAC — Role Permissions

Permissions are stored in the `role_permissions` database table and loaded into memory at startup. Adding a new permission requires only a SQL insert — no code change.

| Permission | Employee | Manager | Admin |
|---|---|---|---|
| `CREATE_GOAL` | ✅ | | |
| `SUBMIT_GOAL` | ✅ | | |
| `APPROVE_GOAL` | | ✅ | |
| `RETURN_GOAL` | | ✅ | |
| `EDIT_GOAL_IN_REVIEW` | | ✅ | |
| `UNLOCK_GOAL` | | | ✅ |
| `PUSH_SHARED_GOAL` | | | ✅ |
| `CONFIGURE_CYCLE` | | | ✅ |
| `CONDUCT_CHECKIN` | | ✅ | |
| `LOG_ACHIEVEMENT` | ✅ | | |
| `VIEW_ALL_REPORTS` | | | ✅ |
| `MANAGE_USERS` | | | ✅ |

---

## Scoring Formulas

The `ScoringService` is a pure, stateless class — zero DB calls, fully unit-testable. It uses a Strategy Pattern with four formulas:

| UoM Type | Formula | Description |
|---|---|---|
| `max` | `score = (actual / target) × 100` | Higher actual is better (e.g. revenue, units sold) |
| `min` | `score = (target / actual) × 100` (capped at 100) | Lower actual is better (e.g. defect count, cost) |
| `timeline` | Tiered by days early/on-time/late | Date-based delivery: on-time = 100, early bonus, late penalty |
| `zero` | `score = 100 if actual == 0 else 0` | Zero is the success condition (e.g. safety incidents) |

Weighted score per employee per quarter:

$$\text{weighted\_score} = \frac{\sum (\text{goal\_score}_i \times \text{weightage}_i)}{100}$$

---

## Good-to-Have Features

All four bonus features are purely additive — they plug into the existing architecture without modifying any core service. This is the Open/Closed Principle at the product level.

### Feature 1 — Email & Microsoft Teams Notifications

The `NotificationService` was designed channel-agnostic from Phase 1. Adding Email and Teams required only two new channel classes — zero changes to existing handlers or services.

**Email** is powered by the [Resend](https://resend.com) API (free 3,000/month) with Jinja2 HTML templates. Every email contains a deep link directly to the relevant portal page and action.

**Microsoft Teams** integration uses Incoming Webhooks with Adaptive Cards — no Azure App registration or bot required.

| Event | Email | Teams | In-app |
|---|---|---|---|
| Goal sheet submitted | Manager ✅ | Manager ✅ | ✅ |
| Goal sheet approved | Employee ✅ | ❌ | ✅ |
| Goal sheet returned | Employee ✅ | ❌ | ✅ |
| Goal unlocked | Employee + Manager ✅ | ❌ | ✅ |
| Check-in completed | Employee ✅ | ❌ | ✅ |
| Window opening soon | All ✅ | All ✅ | ✅ |
| Achievement overdue | Employee ✅ | ❌ | ✅ |
| Check-in not completed | Manager ✅ | Manager ✅ | ✅ |

The in-app notification bell (Phase 1) shows an unread badge, dropdown of last 10 notifications with deep links, and mark-all-as-read.

---

### Feature 2 — Escalation Module (Rule-Based)

A configurable, data-driven escalation engine. Escalation rules are rows in the database — adding a new rule requires only an Admin UI action, no code change.

**New tables:**
- `escalation_rules` — trigger event, condition (JSONB), escalation chain (JSONB array of levels with delays), active flag
- `escalation_log` — per-user per-rule record with level, notification timestamp, resolution status

**Escalation chain example:**
```
Level 0 (day 0): notify the employee themselves
Level 1 (day 3): notify their manager
Level 2 (day 5): notify HR/Admin
```

**Engine:** `EscalationScheduler` runs hourly via APScheduler. It evaluates all active rules, finds affected users, checks escalation_log to avoid duplicate notifications within cooldown, and calls `EscalationService.escalate()`. When the employee resolves the trigger (e.g. submits achievement), the open log record is automatically marked resolved.

**Admin UI:** Rule config table, escalation log with status and manual resolve, summary card showing open and critical escalations. A "Run Check Now" button allows manual trigger for demo.

---

### Feature 3 — Analytics Dashboard

Because Phase 2 built the `analytics_snapshots` CQRS projection, the analytics module is primarily a frontend exercise — all data is pre-aggregated into a single row per user per quarter.

**Backend endpoints (read from snapshots — O(1) per user):**

| Endpoint | Returns |
|---|---|
| `GET /analytics/org-summary` | Org-wide avg score, completion rate, check-in rate, QoQ comparison |
| `GET /analytics/department/{id}` | Department-scoped metrics, top/bottom performers, manager comparison |
| `GET /analytics/individual/{id}` | Employee trajectory, goal-by-goal breakdown, percentile rank |
| `GET /analytics/goal-distribution` | Goals by thrust area, UoM type, status |
| `GET /analytics/manager-effectiveness` | Avg approval turnaround days, team score, check-in rate per manager |
| `GET /analytics/at-risk` | Employees with Q1+Q2 average below 50% flagged for HR intervention |

**Frontend dashboard (Admin only):**
- **Org overview cards** — Total Goals Set, Avg Completion Rate, Avg Weighted Score, Check-in Rate
- **Quarter-on-Quarter trend** — Recharts `LineChart` with lines per department
- **Department heatmap** — CSS grid, rows = departments, columns = Q1–Q4, cells colour-coded green/orange/red, click to drill down
- **Goal distribution** — Recharts `PieChart` (by UoM type) + `BarChart` (by status and thrust area)
- **Manager effectiveness table** — sortable, conditional red formatting if check-in rate < 70%
- **At-risk employee list** — sortable by risk level, one-click to trigger escalation

---

### Feature 4 — Microsoft Entra ID (Azure AD) SSO

Login with a Microsoft organisational account. Once the Azure OAuth2 callback issues the same JWT as email/password auth, the rest of the system — RBAC, services, repositories — is completely unchanged. The auth mechanism is isolated from business logic (Clean Architecture).

**Flow (Authorization Code with PKCE):**
1. User clicks "Sign in with Microsoft" → redirected to Azure with `openid profile email User.Read` scopes
2. Microsoft redirects to `GET /api/v1/auth/azure/callback` with auth code
3. Backend exchanges code via MSAL → decodes `id_token` → email, display name, Azure object ID
4. Azure AD group → role mapping:
   - `CADENCE-Managers` group → `manager`
   - `CADENCE-HR` group → `admin`
   - All others → `employee`
5. Backend upserts user by email, issues standard JWT — session flow identical to email/password auth

**Org hierarchy sync:** Microsoft Graph API `GET /users/{id}/manager` populates `manager_id` on first login, with a nightly APScheduler re-sync.

**Graceful fallback:** If `AZURE_TENANT_ID` env var is absent, the system silently falls back to email/password. Demo accounts always work regardless.

New endpoints added (existing auth endpoints unchanged):
- `GET /api/v1/auth/azure/login` — returns the Azure redirect URL
- `GET /api/v1/auth/azure/callback` — exchanges code, upserts user, returns JWT

---

## License

Internal project — AtomQuest Hackathon 2026.
