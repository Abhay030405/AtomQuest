# Backend Route Tests (Swagger UI)

This checklist is organized by route. For each entry:
- Input: what to paste in Swagger UI (body, params, headers).
- Expected: key fields/behavior to verify.

Assumptions:
- Base URL is http://localhost:8000
- Use the seed credentials from backend_instructions_phase1.md
- When an endpoint requires auth, click Authorize and paste an access token.

---

## 0) Get Tokens (used for all other tests)

### POST /api/v1/auth/login
Input (JSON):
{
  "email": "rahul@atomberg.com",
  "password": "Employee@1234"
}
Expected:
- 200 OK
- success=true
- data.access_token is a JWT string
- data.user.email == rahul@atomberg.com

Repeat for manager and admin:
Input (JSON):
{
  "email": "vikram@atomberg.com",
  "password": "Manager@1234"
}
Input (JSON):
{
  "email": "priya@atomberg.com",
  "password": "Admin@1234"
}
Expected:
- 200 OK and valid tokens for each role

---

## Health & Public

### GET /health
Input: none
Expected:
- 200 OK
- status = healthy
- version and environment present

### GET /api/v1/admin/cycles/active
Input: none
Expected:
- 200 OK
- data.is_open true (if within seed window)
- data.phase == GOAL_SETTING

---

## Auth

### POST /api/v1/auth/refresh
Input (JSON):
{
  "refresh_token": "<paste refresh_token from login>"
}
Expected:
- 200 OK
- data.access_token is a new JWT

### POST /api/v1/auth/logout
Input (JSON):
{
  "refresh_token": "<paste refresh_token from login>"
}
Expected:
- 200 OK
- data.message == Logged out

### GET /api/v1/auth/me
Input: Authorization Bearer <access_token>
Expected:
- 200 OK
- data.user info for the logged-in user

---

## Goals (Employee)

### GET /api/v1/goals/my-sheet
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- Rahul has 5 goals in the sheet
- goals[].status == LOCKED

### POST /api/v1/goals
Input: Authorization Bearer (Rahul token)
Input (JSON):
{
  "title": "Test Draft Goal",
  "description": "Draft goal for testing",
  "thrust_area": "REVENUE_GROWTH",
  "uom_type": "MIN",
  "target_value": 100,
  "target_date": null,
  "weightage": 10
}
Expected:
- 200 OK
- status == DRAFT
- weightage == 10

### PUT /api/v1/goals/{goal_id}
Input: Authorization Bearer (Rahul token)
Input (JSON):
{
  "title": "Updated Draft Goal",
  "weightage": 15
}
Expected:
- 200 OK
- status still DRAFT
- updated fields reflect changes

### DELETE /api/v1/goals/{goal_id}
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- success=true

### POST /api/v1/goals/submit-sheet
Input: Authorization Bearer (Rahul token)
Input (JSON):
{
  "sheet_id": "<Rahul sheet id>"
}
Expected:
- 200 OK
- sheet.status == SUBMITTED
- all goals transitioned to SUBMITTED

### Negative: Min weightage
POST /api/v1/goals
Input: Authorization Bearer (Rahul token)
Input (JSON):
{
  "title": "Invalid Weightage",
  "description": "Too low weightage",
  "thrust_area": "REVENUE_GROWTH",
  "uom_type": "MIN",
  "target_value": 10,
  "target_date": null,
  "weightage": 5
}
Expected:
- 422
- error.code == MIN_WEIGHTAGE

---

## Goals (Manager)

### GET /api/v1/approvals/pending
Input: Authorization Bearer (Vikram token)
Expected:
- 200 OK
- includes Sneha's submitted sheet

### GET /api/v1/approvals/{sheet_id}
Input: Authorization Bearer (Vikram token)
Expected:
- 200 OK
- full sheet with goal versions

### PATCH /api/v1/approvals/{sheet_id}/goals/{goal_id}
Input: Authorization Bearer (Vikram token)
Input (JSON):
{
  "target_value": 12,
  "target_date": null,
  "weightage": 30,
  "change_reason": "Updated targets for review testing"
}
Expected:
- 200 OK
- goal.version incremented

### POST /api/v1/approvals/{sheet_id}/return-for-rework
Input: Authorization Bearer (Vikram token)
Input (JSON):
{
  "reason": "Please revise targets to match Q1 objectives"
}
Expected:
- 200 OK
- sheet.status == DRAFT

### POST /api/v1/approvals/{sheet_id}/approve
Input: Authorization Bearer (Vikram token)
Expected:
- 200 OK
- sheet.status == APPROVED
- goals.status == LOCKED

---

## Shared Goals (Admin)

### POST /api/v1/shared-goals/push
Input: Authorization Bearer (Priya token)
Input (JSON):
{
  "goal_data": {
    "title": "Shared KPI: Customer Satisfaction",
    "description": "Company-wide KPI",
    "thrust_area": "CUSTOMER_SATISFACTION",
    "uom_type": "MIN",
    "target_value": 9,
    "target_date": null,
    "weightage": 20
  },
  "recipient_user_ids": [
    "<Rahul user id>",
    "<Sneha user id>"
  ],
  "suggested_weightage": 20
}
Expected:
- 200 OK
- response lists created goal ids and recipients

### POST /api/v1/admin/goals/{goal_id}/unlock
Input: Authorization Bearer (Priya token)
Input (JSON):
{
  "reason": "Admin unlock for review adjustments"
}
Expected:
- 200 OK
- goal.status == UNDER_REVIEW

---

## Admin Cycle Config

### GET /api/v1/admin/cycles
Input: Authorization Bearer (Priya token)
Expected:
- 200 OK
- grouped by cycle_name

### POST /api/v1/admin/cycles
Input: Authorization Bearer (Priya token)
Input (JSON):
{
  "cycle_name": "FY2027",
  "phase": "GOAL_SETTING",
  "window_open": "2027-05-01T00:00:00Z",
  "window_close": "2027-05-31T23:59:59Z"
}
Expected:
- 200 OK
- created cycle config

### POST /api/v1/admin/cycles/{cycle_id}/activate
Input: Authorization Bearer (Priya token)
Expected:
- 200 OK
- cycle is_active == true

---

## Reports (Admin)

### GET /api/v1/reports/org-stats
Input: Authorization Bearer (Priya token)
Expected:
- 200 OK
- completion_percentage present

### GET /api/v1/reports/goals
Input: Authorization Bearer (Priya token)
Query params:
- page=1
- page_size=20
Expected:
- 200 OK
- data.items list with goal report rows

### GET /api/v1/reports/goals/export
Input: Authorization Bearer (Priya token)
Expected:
- 200 OK
- content-type text/csv
- content-disposition includes filename

---

## Audit Logs (Admin)

### GET /api/v1/audit-logs
Input: Authorization Bearer (Priya token)
Query params:
- page=1
- page_size=20
Expected:
- 200 OK
- data.items list of audit entries

### Negative: audit as employee
Input: Authorization Bearer (Rahul token)
Expected:
- 403
- error.code == FORBIDDEN

---

## Notifications

### GET /api/v1/notifications
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- list ordered newest first

### GET /api/v1/notifications/unread-count
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- count is an integer

### PATCH /api/v1/notifications/{notification_id}/read
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- notification.is_read == true

### POST /api/v1/notifications/mark-all-read
Input: Authorization Bearer (Rahul token)
Expected:
- 200 OK
- updated_count >= 0
