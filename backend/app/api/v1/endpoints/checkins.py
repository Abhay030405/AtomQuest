"""Phase 2 — Manager check-in endpoints (Build plan §4.2).

Thin HTTP layer: validate → require_permission → call service → APIResponse.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_id, require_permission
from app.core.constants import Permission, Quarter
from app.core.exceptions import CycleNotFoundError
from app.schemas.checkin import CheckinCreate, CheckinResponse, CheckinUpdate
from app.schemas.common import APIResponse
from app.services.checkin_service import checkin_service
from app.services.cycle_service import cycle_service


router = APIRouter()


def _serialize(checkin) -> CheckinResponse:
	return CheckinResponse.model_validate(checkin)


@router.get("/team-status", response_model=APIResponse[list[dict]])
async def get_team_status(
	quarter: Quarter = Query(...),
	cycle_id: UUID | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.CONDUCT_CHECKIN)),
) -> APIResponse[list[dict]]:
	"""Reads from ``analytics_snapshots`` (CQRS read model)."""
	if cycle_id is None:
		active = await cycle_service.get_active_window(db)
		if active is None:
			raise CycleNotFoundError()
		cycle_id = active.id
	rows = await checkin_service.get_team_status(current_user, quarter, cycle_id, db)
	# Stringify UUIDs / decimals at the boundary.
	out = [
		{
			"employee_id": str(r["employee_id"]),
			"quarter": r["quarter"].value if hasattr(r["quarter"], "value") else r["quarter"],
			"cycle_id": str(r["cycle_id"]),
			"weighted_score": (
				str(r["weighted_score"]) if r["weighted_score"] is not None else None
			),
			"goals_total": r["goals_total"],
			"goals_submitted": r["goals_submitted"],
			"goals_completed": r["goals_completed"],
			"achievement_submitted": r["achievement_submitted"],
			"checkin_done": r["checkin_done"],
			"snapshot_generated_at": (
				r["snapshot_generated_at"].isoformat()
				if r["snapshot_generated_at"]
				else None
			),
		}
		for r in rows
	]
	return APIResponse.ok(out)


@router.get("/employee/{employee_id}", response_model=APIResponse[dict])
async def get_employee_detail(
	employee_id: UUID,
	quarter: Quarter = Query(...),
	cycle_id: UUID | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.CONDUCT_CHECKIN)),
) -> APIResponse[dict]:
	"""Reads live tables. Manager-only — checked inside the service."""
	if cycle_id is None:
		active = await cycle_service.get_active_window(db)
		if active is None:
			raise CycleNotFoundError()
		cycle_id = active.id
	detail = await checkin_service.get_employee_detail(
		current_user, employee_id, quarter, cycle_id, db
	)
	view = {
		"employee": {
			"id": str(detail["employee"]["id"]),
			"full_name": detail["employee"]["full_name"],
			"email": detail["employee"]["email"],
			"role": detail["employee"]["role"].value,
			"manager_id": (
				str(detail["employee"]["manager_id"])
				if detail["employee"]["manager_id"]
				else None
			),
		},
		"quarter": detail["quarter"].value,
		"cycle_id": str(detail["cycle_id"]),
		"goals": [
			{
				"id": str(g["id"]),
				"title": g["title"],
				"thrust_area": g["thrust_area"].value if hasattr(g["thrust_area"], "value") else str(g["thrust_area"]),
				"uom_type": g["uom_type"].value if hasattr(g["uom_type"], "value") else str(g["uom_type"]),
				"target_value": str(g["target_value"]) if g["target_value"] is not None else None,
				"target_date": g["target_date"].isoformat() if g["target_date"] else None,
				"weightage": str(g["weightage"]),
				"status": g["status"].value if hasattr(g["status"], "value") else str(g["status"]),
				"achievement": (
					_serialize_ach(g["achievement"]) if g["achievement"] is not None else None
				),
			}
			for g in detail["goals"]
		],
		"existing_checkin": (
			_serialize(detail["existing_checkin"]).model_dump(mode="json")
			if detail["existing_checkin"] is not None
			else None
		),
	}
	return APIResponse.ok(view)


def _serialize_ach(ach) -> dict:
	from app.schemas.achievement import AchievementResponse

	return AchievementResponse.model_validate(ach).model_dump(mode="json")


@router.post("/", response_model=APIResponse[CheckinResponse])
async def create_checkin(
	payload: CheckinCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.CONDUCT_CHECKIN)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[CheckinResponse]:
	checkin = await checkin_service.create_checkin(
		current_user, payload, db, request_id=request_id
	)
	return APIResponse.ok(_serialize(checkin))


@router.patch("/{checkin_id}", response_model=APIResponse[CheckinResponse])
async def update_checkin(
	checkin_id: UUID,
	payload: CheckinUpdate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.EDIT_CHECKIN)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[CheckinResponse]:
	checkin = await checkin_service.update_checkin(
		current_user, checkin_id, payload, db, request_id=request_id
	)
	return APIResponse.ok(_serialize(checkin))


@router.post("/{checkin_id}/acknowledge", response_model=APIResponse[CheckinResponse])
async def acknowledge_checkin(
	checkin_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.ACKNOWLEDGE_CHECKIN)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[CheckinResponse]:
	checkin = await checkin_service.acknowledge(
		current_user, checkin_id, db, request_id=request_id
	)
	return APIResponse.ok(_serialize(checkin))
