from __future__ import annotations

from io import StringIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
	get_current_admin,
	get_db,
	get_pagination,
	require_permission,
)
from app.core.constants import GoalSheetStatus, Permission, Quarter
from app.core.exceptions import CycleNotFoundError
from app.repositories.analytics_snapshot_repository import AnalyticsSnapshotRepository
from app.schemas.common import APIResponse
from app.schemas.report import GoalReportRow, OrgStatsResponse
from app.services.checkin_completion_tracker import checkin_completion_tracker
from app.services.cycle_service import cycle_service
from app.services.report_service import (
	AchievementReportBuilder,
	CSVExporter,
	report_service,
)


router = APIRouter()


# NOTE: /goals/export must come before /goals to avoid routing conflicts
@router.get("/goals/export")
async def export_goals_csv(
	department_id: Optional[UUID] = Query(default=None),
	manager_id: Optional[UUID] = Query(default=None),
	status: Optional[GoalSheetStatus] = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> StreamingResponse:
	filters: dict = {}
	if department_id:
		filters["department_id"] = department_id
	if manager_id:
		filters["manager_id"] = manager_id
	if status:
		filters["status"] = status

	rows, _ = await report_service.get_goal_report(filters, skip=0, limit=100_000, db=db)
	csv_content = report_service.generate_csv_content(rows)

	return StreamingResponse(
		StringIO(csv_content),
		media_type="text/csv",
		headers={"Content-Disposition": "attachment; filename=goal_report.csv"},
	)


@router.get("/goals", response_model=APIResponse[list[GoalReportRow]])
async def get_goal_report(
	department_id: Optional[UUID] = Query(default=None),
	manager_id: Optional[UUID] = Query(default=None),
	status: Optional[GoalSheetStatus] = Query(default=None),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[list[GoalReportRow]]:
	filters: dict = {}
	if department_id:
		filters["department_id"] = department_id
	if manager_id:
		filters["manager_id"] = manager_id
	if status:
		filters["status"] = status

	rows, _ = await report_service.get_goal_report(filters, skip=pagination.skip, limit=pagination.limit, db=db)
	return APIResponse.ok(rows)


@router.get("/org-stats", response_model=APIResponse[OrgStatsResponse])
async def get_org_stats(
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[OrgStatsResponse]:
	stats = await report_service.get_org_stats(db)
	return APIResponse.ok(stats)


# ---------------------------------------------------------------------------
# Phase 2 — Reports & Analytics (Build plan §4.3)
# ---------------------------------------------------------------------------


async def _resolve_cycle_id(cycle_id: Optional[UUID], db: AsyncSession) -> UUID:
	"""Fall back to the active cycle when the caller omits ``cycle_id``."""
	if cycle_id is not None:
		return cycle_id
	active = await cycle_service.get_active_window(db)
	if active is None:
		raise CycleNotFoundError()
	return active.id


@router.get("/completion-dashboard", response_model=APIResponse[list[dict]])
async def get_completion_dashboard(
	cycle_id: Optional[UUID] = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(require_permission(Permission.VIEW_ANALYTICS)),
) -> APIResponse[list[dict]]:
	"""Heat-map data sourced from ``analytics_snapshots``."""
	resolved = await _resolve_cycle_id(cycle_id, db)
	repo = AnalyticsSnapshotRepository(db)
	rows = await repo.get_completion_heatmap(resolved)
	# UUIDs / enum quarters → strings at the boundary.
	out = [
		{
			"department_id": str(r["department_id"]) if r["department_id"] else None,
			"department_name": r["department_name"],
			"quarter": (
				r["quarter"].value if hasattr(r["quarter"], "value") else r["quarter"]
			),
			"total_employees": r["total_employees"],
			"achievement_submitted_count": r["achievement_submitted_count"],
			"checkin_done_count": r["checkin_done_count"],
			"achievement_pct": round(r["achievement_pct"], 2),
			"checkin_pct": round(r["checkin_pct"], 2),
		}
		for r in rows
	]
	return APIResponse.ok(out)


@router.get("/achievement", response_model=APIResponse[list[dict]])
async def get_achievement_report(
	quarter: Quarter = Query(...),
	cycle_id: Optional[UUID] = Query(default=None),
	department_id: Optional[UUID] = Query(default=None),
	manager_id: Optional[UUID] = Query(default=None),
	include_qoq: bool = Query(default=False),
	pagination=Depends(get_pagination),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(require_permission(Permission.EXPORT_ACHIEVEMENT_REPORT)),
) -> APIResponse[list[dict]]:
	"""Paginated JSON view backed by ``AchievementReportBuilder``."""
	resolved = await _resolve_cycle_id(cycle_id, db)
	builder = (
		AchievementReportBuilder()
		.for_cycle(resolved)
		.for_quarter(quarter)
		.include_scores()
	)
	if department_id:
		builder = builder.for_department(department_id)
	if manager_id:
		builder = builder.for_manager(manager_id)
	if include_qoq:
		builder = builder.include_qoq_comparison()

	# Materialise the stream into a paginated window. The builder streams to
	# keep memory flat — we walk to (skip + limit) and stop early.
	skip = pagination.skip
	limit = pagination.limit
	collected: list[dict] = []
	idx = 0
	async for row in builder.build(db):
		if idx >= skip + limit:
			break
		if idx >= skip:
			collected.append(row.to_dict())
		idx += 1
	return APIResponse.ok(collected)


@router.get("/achievement/export")
async def export_achievement_report(
	quarter: Quarter = Query(...),
	cycle_id: Optional[UUID] = Query(default=None),
	department_id: Optional[UUID] = Query(default=None),
	manager_id: Optional[UUID] = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(require_permission(Permission.EXPORT_ACHIEVEMENT_REPORT)),
) -> StreamingResponse:
	"""Streaming CSV — memory-bounded for org-wide exports."""
	resolved = await _resolve_cycle_id(cycle_id, db)
	builder = (
		AchievementReportBuilder()
		.for_cycle(resolved)
		.for_quarter(quarter)
		.include_scores()
	)
	if department_id:
		builder = builder.for_department(department_id)
	if manager_id:
		builder = builder.for_manager(manager_id)

	row_iter = builder.build(db)
	filename = f"achievement_report_{quarter.value}_{resolved}.csv"
	return StreamingResponse(
		CSVExporter.stream(row_iter),
		media_type="text/csv",
		headers={"Content-Disposition": f'attachment; filename="{filename}"'},
	)


@router.get("/overdue", response_model=APIResponse[list[dict]])
async def get_overdue_users(
	quarter: Quarter = Query(...),
	cycle_id: Optional[UUID] = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_: object = Depends(require_permission(Permission.VIEW_ANALYTICS)),
) -> APIResponse[list[dict]]:
	"""Users with missing check-in for the (quarter, cycle)."""
	resolved = await _resolve_cycle_id(cycle_id, db)
	users = await checkin_completion_tracker.get_overdue_users(quarter, resolved, db)
	return APIResponse.ok(
		[
			{
				"user_id": str(u.user_id),
				"full_name": u.full_name,
				"email": u.email,
				"manager_id": str(u.manager_id) if u.manager_id else None,
				"days_since_window_open": u.days_since_window_open,
				"quarter": quarter.value,
				"cycle_id": str(resolved),
			}
			for u in users
		]
	)
