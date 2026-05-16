from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.core.constants import CyclePhase, Permission
from app.core.exceptions import CycleNotFoundError
from app.models.cycle_config import CycleConfig
from app.schemas.common import APIResponse, BaseSchema
from app.services.cycle_service import cycle_service
from app.services.shared_goal_service import shared_goal_service


router = APIRouter()


class CycleCreate(BaseSchema):
	cycle_name: str = Field(min_length=3, max_length=100)
	phase: CyclePhase
	window_open: datetime
	window_close: datetime

	@model_validator(mode="after")
	def validate_window(self) -> "CycleCreate":
		if self.window_open >= self.window_close:
			raise ValueError("window_open must be before window_close")
		return self


class CycleUpdate(BaseSchema):
	cycle_name: Optional[str] = Field(default=None, min_length=3, max_length=100)
	phase: Optional[CyclePhase] = None
	window_open: Optional[datetime] = None
	window_close: Optional[datetime] = None


class CycleResponse(BaseSchema):
	id: UUID
	cycle_name: str
	phase: CyclePhase
	window_open: datetime
	window_close: datetime
	is_active: bool
	created_by: Optional[UUID] = None
	created_at: datetime


class UnlockGoalRequest(BaseSchema):
	reason: str = Field(min_length=30, max_length=500)


def _build_cycle_response(cycle: CycleConfig) -> CycleResponse:
	return CycleResponse.model_validate(
		{
			"id": cycle.id,
			"cycle_name": cycle.cycle_name,
			"phase": cycle.phase,
			"window_open": cycle.window_open,
			"window_close": cycle.window_close,
			"is_active": cycle.is_active,
			"created_by": cycle.created_by,
			"created_at": cycle.created_at,
		}
	)


# NOTE: /active must come before /{cycle_id} to avoid routing conflicts
@router.get("/cycles/active", response_model=APIResponse[dict])
async def get_active_cycle(
	db: AsyncSession = Depends(get_db),
) -> APIResponse[dict]:
	"""Public endpoint — no authentication required."""
	status = await cycle_service.get_window_status(db)
	return APIResponse.ok(status)


@router.get("/cycles", response_model=APIResponse[list[CycleResponse]])
async def list_cycles(
	db: AsyncSession = Depends(get_db),
	_: object = Depends(get_current_admin),
) -> APIResponse[list[CycleResponse]]:
	stmt = select(CycleConfig).order_by(CycleConfig.created_at.desc())
	result = await db.execute(stmt)
	cycles = list(result.scalars().all())
	return APIResponse.ok([_build_cycle_response(cycle) for cycle in cycles])


@router.post("/cycles", response_model=APIResponse[CycleResponse])
async def create_cycle(
	payload: CycleCreate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[CycleResponse]:
	data = payload.model_dump()
	data["created_by"] = current_user.id
	cycle = await cycle_service.create_window(data, current_user, db)
	await db.commit()
	await db.refresh(cycle)
	return APIResponse.ok(_build_cycle_response(cycle))


@router.patch("/cycles/{cycle_id}", response_model=APIResponse[CycleResponse])
async def update_cycle(
	cycle_id: UUID,
	payload: CycleUpdate,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[CycleResponse]:
	stmt = select(CycleConfig).where(CycleConfig.id == cycle_id)
	result = await db.execute(stmt)
	cycle = result.scalar_one_or_none()
	if cycle is None:
		raise CycleNotFoundError()
	updates = payload.model_dump(exclude_unset=True)
	for field, value in updates.items():
		setattr(cycle, field, value)
	await db.commit()
	await db.refresh(cycle)
	return APIResponse.ok(_build_cycle_response(cycle))


@router.post("/cycles/{cycle_id}/activate", response_model=APIResponse[CycleResponse])
async def activate_cycle(
	cycle_id: UUID,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[CycleResponse]:
	cycle = await cycle_service.activate_window(cycle_id, current_user, db)
	await db.commit()
	await db.refresh(cycle)
	return APIResponse.ok(_build_cycle_response(cycle))


@router.post("/goals/{goal_id}/unlock", response_model=APIResponse[dict])
async def unlock_goal(
	goal_id: UUID,
	payload: UnlockGoalRequest,
	db: AsyncSession = Depends(get_db),
	current_user=Depends(get_current_admin),
) -> APIResponse[dict]:
	await shared_goal_service.unlock_goal(goal_id, current_user, payload.reason, db)
	return APIResponse.ok({"message": "Goal unlocked successfully"})
