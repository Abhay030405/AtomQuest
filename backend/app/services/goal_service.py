from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalEventType, GoalSheetStatus, GoalStatus, NotificationType
from app.core.exceptions import (
	ForbiddenError,
	GoalCountError,
	GoalLockedError,
	GoalSheetNotFoundError,
	MinWeightageError,
	WeightageError,
)
from app.models.goal import Goal
from app.models.goal_event import GoalEvent
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.services.audit_service import audit_service
from app.services.cycle_service import cycle_service
from app.services.notification_service import notification_service
from app.services.version_service import version_service


@dataclass
class ValidationError:
	code: str
	message: str


@dataclass
class ValidationResult:
	is_valid: bool
	errors: list[ValidationError]


class GoalService:
	async def create_goal(self, user: User, data: Any, db: AsyncSession) -> Goal:
		cycle = await cycle_service.require_open_window(db)
		repo = GoalRepository(db)
		count = await repo.count_goals_in_cycle(user.id, cycle.id)
		if count >= 8:
			raise GoalCountError()
		if data.weightage < Decimal("10.00"):
			raise MinWeightageError()

		sheet = await self.get_or_create_sheet(user.id, cycle.id, db)
		goal = Goal(
			user_id=user.id,
			goal_sheet_id=sheet.id,
			title=data.title,
			description=data.description,
			thrust_area=data.thrust_area,
			uom_type=data.uom_type,
			target_value=data.target_value,
			target_date=data.target_date,
			weightage=data.weightage,
			status=GoalStatus.DRAFT,
			is_shared=False,
			cycle_id=cycle.id,
		)
		db.add(goal)
		await db.flush()

		await version_service.snapshot_goal(goal, user, "Initial creation", db)
		await audit_service.log_create("goals", goal.id, user, db)
		db.add(
			GoalEvent(
				goal_id=goal.id,
				event_type=GoalEventType.GOAL_CREATED,
				actor_id=user.id,
				payload=None,
			)
		)
		await notification_service.create_in_app(
			user.id,
			NotificationType.WINDOW_OPENING,
			"Goal added to your sheet",
			"A new goal has been added to your sheet.",
			db,
			related_goal_id=goal.id,
		)
		await db.commit()
		await db.refresh(goal)
		return goal

	async def validate_sheet(self, goal_sheet_id: UUID, db: AsyncSession) -> ValidationResult:
		stmt = select(GoalSheet).options(selectinload(GoalSheet.goals)).where(GoalSheet.id == goal_sheet_id)
		result = await db.execute(stmt)
		sheet = result.scalar_one_or_none()
		if sheet is None:
			return ValidationResult(False, [ValidationError("GOAL_SHEET_NOT_FOUND", "Goal sheet not found")])

		errors: list[ValidationError] = []
		goals = [goal for goal in sheet.goals if not goal.is_deleted]

		if not (1 <= len(goals) <= 8):
			errors.append(ValidationError("GOAL_COUNT_ERROR", "Goal count must be between 1 and 8"))

		total_weightage = sum((goal.weightage for goal in goals), Decimal("0"))
		if total_weightage.quantize(Decimal("0.01")) != Decimal("100.00"):
			errors.append(ValidationError("WEIGHTAGE_ERROR", "Total weightage must equal 100%"))

		for goal in goals:
			if goal.weightage < Decimal("10.00"):
				errors.append(ValidationError("MIN_WEIGHTAGE_ERROR", "Each goal must have at least 10% weightage"))
				break

		if any(goal.status != GoalStatus.DRAFT for goal in goals):
			errors.append(ValidationError("INVALID_STATE", "All goals must be in DRAFT status"))

		return ValidationResult(len(errors) == 0, errors)

	async def submit_sheet(self, goal_sheet_id: UUID, user: User, db: AsyncSession) -> GoalSheet:
		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals))
			.where(GoalSheet.id == goal_sheet_id, GoalSheet.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		sheet = result.scalar_one_or_none()
		if sheet is None:
			raise GoalSheetNotFoundError()
		if sheet.user_id != user.id:
			raise ForbiddenError()
		if sheet.status != GoalSheetStatus.DRAFT:
			raise WeightageError()

		validation = await self.validate_sheet(goal_sheet_id, db)
		if not validation.is_valid:
			raise WeightageError()

		for goal in sheet.goals:
			goal.status = GoalStatus.SUBMITTED
			goal.version += 1
			await version_service.snapshot_goal(goal, user, "Submitted", db)
			db.add(
				GoalEvent(
					goal_id=goal.id,
					event_type=GoalEventType.GOAL_SUBMITTED,
					actor_id=user.id,
					payload=None,
				)
			)

		sheet.status = GoalSheetStatus.SUBMITTED
		sheet.submitted_at = datetime.now(timezone.utc)
		await audit_service.log_update("goal_sheets", sheet.id, user, "status", "draft", "submitted", db)
		if user.manager_id:
			await notification_service.create_in_app(
				user.manager_id,
				NotificationType.GOAL_SUBMITTED,
				"Goal sheet submitted",
				f"{user.full_name} has submitted their goal sheet for review.",
				db,
			)
		await db.commit()
		await db.refresh(sheet)
		return sheet

	async def update_goal(self, goal_id: UUID, user: User, data: Any, db: AsyncSession) -> Goal:
		repo = GoalRepository(db)
		goal = await repo.get_or_raise(goal_id)
		if goal.user_id != user.id:
			raise ForbiddenError()
		if goal.status != GoalStatus.DRAFT:
			raise GoalLockedError()

		old_snapshot = goal.to_dict()
		for field, value in data.model_dump(exclude_unset=True).items():
			if field == "id":
				continue
			setattr(goal, field, value)
		goal.version += 1

		await version_service.snapshot_goal(goal, user, "Employee edited draft", db)
		await audit_service.log_goal_changes(old_snapshot, goal, user, db)
		await db.commit()
		await db.refresh(goal)
		return goal

	async def delete_goal(self, goal_id: UUID, user: User, db: AsyncSession) -> None:
		repo = GoalRepository(db)
		goal = await repo.get_or_raise(goal_id)
		if goal.user_id != user.id:
			raise ForbiddenError()
		if goal.status != GoalStatus.DRAFT:
			raise GoalLockedError()
		await repo.soft_delete(goal)
		await audit_service.log_update("goals", goal.id, user, "is_deleted", False, True, db)
		await db.commit()

	async def get_my_sheet(self, user: User, cycle_id: UUID, db: AsyncSession) -> GoalSheet | None:
		stmt = (
			select(GoalSheet)
			.options(selectinload(GoalSheet.goals).selectinload(Goal.versions))
			.where(GoalSheet.user_id == user.id, GoalSheet.cycle_id == cycle_id)
			.where(GoalSheet.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		return result.scalar_one_or_none()

	async def get_or_create_sheet(self, user_id: UUID, cycle_id: UUID, db: AsyncSession) -> GoalSheet:
		repo = GoalRepository(db)
		existing = await repo.get_sheet_for_user(user_id, cycle_id)
		if existing:
			return existing
		sheet = GoalSheet(user_id=user_id, cycle_id=cycle_id, status=GoalSheetStatus.DRAFT, returned_count=0)
		db.add(sheet)
		await db.flush()
		return sheet


goal_service = GoalService()
