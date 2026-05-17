from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
	achievements,
	admin,
	approvals,
	audit,
	auth,
	checkins,
	goal_versions,
	goals,
	notifications,
	reports,
	shared_goals,
	users,
)


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(goal_versions.router, prefix="/goals", tags=["Goal History"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Approvals"])
api_router.include_router(shared_goals.router, prefix="/shared-goals", tags=["Shared Goals"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(
	achievements.router, prefix="/achievements", tags=["Achievements"]
)
api_router.include_router(checkins.router, prefix="/checkins", tags=["Check-ins"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["Audit"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
