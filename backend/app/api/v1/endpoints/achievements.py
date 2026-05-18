"""Phase 2 — Achievement endpoints (Build plan §4.1).

Thin HTTP layer:
  1. Pydantic validates the payload.
  2. ``require_permission(...)`` enforces RBAC.
  3. The service does all the work (cycle guard, scoring, event publication).
  4. Result is wrapped in ``APIResponse``.

No business logic, no DB queries, no event firing in this module.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_id, require_permission
from app.core.constants import Permission, Quarter
from app.core.exceptions import CycleNotFoundError
from app.schemas.achievement import (
	AchievementBulkCreate,
	AchievementCreate,
	AchievementResponse,
	AchievementResubmit,
)
from app.schemas.common import APIResponse
from app.services.achievement_service import achievement_service
from app.services.cycle_service import cycle_service


router = APIRouter()


def _serialize(achievement) -> AchievementResponse:
	return AchievementResponse.model_validate(achievement)


@router.get("/my-quarter", response_model=APIResponse[dict])
async def get_my_quarter(
	quarter: Quarter = Query(...),
	cycle_id: UUID | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.LOG_ACHIEVEMENT)),
) -> APIResponse[dict]:
	if cycle_id is None:
		active = await cycle_service.get_active_window(db)
		if active is None:
			raise CycleNotFoundError()
		cycle_id = active.id
	payload = await achievement_service.get_my_quarter(
		current_user.id, quarter, cycle_id, db
	)
	# Normalise model instances into JSON-friendly dicts at the boundary.
	view = {
		"quarter": payload["quarter"].value,
		"cycle_id": str(payload["cycle_id"]),
		"window": payload["window"],
		"goals": [
			{
				"goal": {
					"id": str(entry["goal"].id),
					"title": entry["goal"].title,
					"uom_type": entry["goal"].uom_type.value,
					"target_value": (
						str(entry["goal"].target_value)
						if entry["goal"].target_value is not None
						else None
					),
					"target_date": (
						entry["goal"].target_date.isoformat()
						if entry["goal"].target_date
						else None
					),
					"weightage": str(entry["goal"].weightage),
					"status": entry["goal"].status.value,
					"source_shared_goal_id": (
						str(entry["goal"].source_shared_goal_id)
						if entry["goal"].source_shared_goal_id is not None
						else None
					),
				},
				"achievement": (
					_serialize(entry["achievement"]).model_dump(mode="json")
					if entry["achievement"] is not None
					else None
				),
			}
			for entry in payload["goals"]
		],
	}
	return APIResponse.ok(view)


@router.post("/", response_model=APIResponse[AchievementResponse])
async def log_achievement(
	payload: AchievementCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.LOG_ACHIEVEMENT)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[AchievementResponse]:
	result = await achievement_service.log_achievement(
		current_user, payload, db, request_id=request_id
	)
	return APIResponse.ok(_serialize(result))


@router.post("/bulk", response_model=APIResponse[list[AchievementResponse]])
async def bulk_log_achievements(
	payload: AchievementBulkCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.LOG_ACHIEVEMENT)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[list[AchievementResponse]]:
	results = await achievement_service.bulk_log(
		current_user, payload, db, request_id=request_id
	)
	return APIResponse.ok([_serialize(r) for r in results])


@router.patch("/{achievement_id}/resubmit", response_model=APIResponse[AchievementResponse])
async def resubmit_achievement(
	achievement_id: UUID,
	payload: AchievementResubmit,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.RESUBMIT_ACHIEVEMENT)),
	request_id: str = Depends(get_request_id),
) -> APIResponse[AchievementResponse]:
	result = await achievement_service.resubmit(
		current_user, achievement_id, payload, db, request_id=request_id
	)
	return APIResponse.ok(_serialize(result))


@router.get("/my-history", response_model=APIResponse[list[AchievementResponse]])
async def get_my_history(
	db: AsyncSession = Depends(get_db),
	current_user=Depends(require_permission(Permission.LOG_ACHIEVEMENT)),
) -> APIResponse[list[AchievementResponse]]:
	rows = await achievement_service.get_user_history(current_user.id, db)
	return APIResponse.ok([_serialize(r) for r in rows])
