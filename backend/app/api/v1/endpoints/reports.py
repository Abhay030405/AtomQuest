from __future__ import annotations

from io import StringIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db, get_pagination
from app.core.constants import GoalSheetStatus
from app.schemas.common import APIResponse
from app.schemas.report import GoalReportRow, OrgStatsResponse
from app.services.report_service import report_service


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
