from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import GoalSheetStatus, GoalStatus
from app.core.exceptions import (
	ForbiddenError,
	GoalCountError,
	GoalLockedError,
	GoalSheetNotFoundError,
	MinWeightageError,
	WeightageError,
)
from app.events import goal_events as ge
from app.events.event_bus import event_bus
from app.models.goal import Goal
from app.models.goal_sheet import GoalSheet
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.services.cycle_service import cycle_service
from app.services.goal_state_machine import goal_state_machine
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
		await event_bus.publish(
			ge.GOAL_CREATED,
			{
				"goal_id": goal.id,
				"user_id": user.id,
				"user_name": user.full_name,
				"cycle_id": cycle.id,
				"actor_id": user.id,
				"actor_role": user.role,
				"payload": None,
			},
			db,
		)
		await db.commit()
		stmt = (
			select(Goal)
			.options(selectinload(Goal.owner), selectinload(Goal.locker), selectinload(Goal.goal_sheet))
			.where(Goal.id == goal.id)
		)
		result = await db.execute(stmt)
		return result.scalar_one()


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

	async def submit_sheet(
		self,
		goal_sheet_id: UUID,
		user: User,
		db: AsyncSession,
		goal_ids: list[UUID] | None = None,
	) -> GoalSheet:
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

		# Allow re-submission when a sheet has previously been approved but the
		# employee has added new draft goals afterwards. Only DRAFT-status goals
		# get transitioned; already-LOCKED/APPROVED goals are left untouched.
		if sheet.status not in {GoalSheetStatus.DRAFT, GoalSheetStatus.APPROVED}:
			raise WeightageError(
				"Goal sheet is already submitted and awaiting manager review.",
				code="SHEET_ALREADY_SUBMITTED",
			)

		active_goals = [g for g in sheet.goals if not g.is_deleted]
		all_draft_goals = [g for g in active_goals if g.status == GoalStatus.DRAFT]

		# Optional subset: caller may stage only some drafts (the client-side
		# "Submitted" column). Only those drafts are transitioned and counted
		# toward the 100% rule; unstaged drafts remain on the sheet as DRAFT.
		if goal_ids is not None:
			requested = set(goal_ids)
			draft_goals = [g for g in all_draft_goals if g.id in requested]
			missing = requested - {g.id for g in draft_goals}
			if missing:
				raise WeightageError(
					"Some goals could not be submitted (not found or not in draft).",
					code="INVALID_GOAL_IDS",
				)
		else:
			draft_goals = all_draft_goals

		if not draft_goals:
			raise WeightageError(
				"There are no draft goals to submit.",
				code="NO_DRAFT_GOALS",
			)

		# Goals that will appear on the submitted sheet = newly-submitted drafts
		# + anything already SUBMITTED/APPROVED/LOCKED on the sheet. Unstaged
		# drafts are excluded from both the count limit and the weightage sum.
		counted_goals = [g for g in active_goals if g.status != GoalStatus.DRAFT] + draft_goals
		if not (1 <= len(counted_goals) <= 8):
			raise WeightageError(
				"Goal count must be between 1 and 8.",
				code="GOAL_COUNT_ERROR",
			)
		total_weightage = sum((g.weightage for g in counted_goals), Decimal("0"))
		if total_weightage.quantize(Decimal("0.01")) != Decimal("100.00"):
			raise WeightageError(
				f"Total weightage must equal 100% (currently {total_weightage.quantize(Decimal('0.01'))}%).",
			)
		for g in draft_goals:
			if g.weightage < Decimal("10.00"):
				raise WeightageError(
					"Each goal must have at least 10% weightage.",
					code="MIN_WEIGHTAGE_ERROR",
				)

		for goal in draft_goals:
			goal_state_machine.transition(goal, GoalStatus.SUBMITTED, user)
			await version_service.snapshot_goal(goal, user, "Submitted", db)
			await event_bus.publish(
				ge.GOAL_SUBMITTED,
				{
					"goal_id": goal.id,
					"user_id": user.id,
					"user_name": user.full_name,
					"manager_id": user.manager_id,
					"actor_id": user.id,
					"actor_role": user.role,
					"payload": None,
				},
				db,
			)

		old_status = sheet.status.value
		sheet.status = GoalSheetStatus.SUBMITTED
		sheet.submitted_at = datetime.now(timezone.utc)
		await event_bus.publish(
			ge.GOAL_SHEET_SUBMITTED,
			{
				"goal_sheet_id": sheet.id,
				"user_id": user.id,
				"user_name": user.full_name,
				"manager_id": user.manager_id,
				"goal_count": len(draft_goals),
				"actor_id": user.id,
				"actor_role": user.role,
				"old_status": old_status,
			},
			db,
		)
		await db.commit()
		await db.refresh(sheet)
		return sheet

	async def submit_goal(self, goal_id: UUID, user: User, db: AsyncSession) -> Goal:
		"""Submit a SINGLE draft goal for manager approval.

		Unlike `submit_sheet`, this transitions only the requested goal from
		DRAFT to SUBMITTED. The parent sheet's status is moved to SUBMITTED so
		it surfaces in the manager's pending-approval queue, while other draft
		goals remain in DRAFT and other locked goals stay locked.
		"""
		stmt = (
			select(Goal)
			.options(
				selectinload(Goal.goal_sheet).selectinload(GoalSheet.goals),
				selectinload(Goal.owner),
			)
			.where(Goal.id == goal_id, Goal.is_deleted.is_(False))
		)
		result = await db.execute(stmt)
		goal = result.scalar_one_or_none()
		if goal is None:
			raise GoalSheetNotFoundError()
		if goal.user_id != user.id:
			raise ForbiddenError()
		if goal.status != GoalStatus.DRAFT:
			raise WeightageError(
				"Only draft goals can be submitted for approval.",
				code="INVALID_STATE",
			)
		if goal.weightage < Decimal("10.00"):
			raise WeightageError(
				"Each goal must have at least 10% weightage.",
				code="MIN_WEIGHTAGE_ERROR",
			)

		sheet = goal.goal_sheet
		if sheet is None:
			raise GoalSheetNotFoundError()

		active_goals = [g for g in sheet.goals if not g.is_deleted]
		if not (1 <= len(active_goals) <= 8):
			raise WeightageError(
				"Goal count must be between 1 and 8.",
				code="GOAL_COUNT_ERROR",
			)
		total_weightage = sum((g.weightage for g in active_goals), Decimal("0"))
		if total_weightage.quantize(Decimal("0.01")) != Decimal("100.00"):
			raise WeightageError(
				f"Total weightage must equal 100% (currently {total_weightage.quantize(Decimal('0.01'))}%).",
			)

		goal_state_machine.transition(goal, GoalStatus.SUBMITTED, user)
		await version_service.snapshot_goal(goal, user, "Submitted", db)
		await event_bus.publish(
			ge.GOAL_SUBMITTED,
			{
				"goal_id": goal.id,
				"user_id": user.id,
				"user_name": user.full_name,
				"manager_id": user.manager_id,
				"actor_id": user.id,
				"actor_role": user.role,
				"payload": None,
			},
			db,
		)

		# Move sheet into SUBMITTED so manager sees it pending approval. If the
		# sheet was previously APPROVED (re-submission scenario) this still puts
		# it back into the manager's queue; already-LOCKED goals remain locked.
		if sheet.status in {GoalSheetStatus.DRAFT, GoalSheetStatus.APPROVED}:
			old_status = sheet.status.value
			sheet.status = GoalSheetStatus.SUBMITTED
			sheet.submitted_at = datetime.now(timezone.utc)
			await event_bus.publish(
				ge.GOAL_SHEET_SUBMITTED,
				{
					"goal_sheet_id": sheet.id,
					"user_id": user.id,
					"user_name": user.full_name,
					"manager_id": user.manager_id,
					"goal_count": 1,
					"actor_id": user.id,
					"actor_role": user.role,
					"old_status": old_status,
				},
				db,
			)

		await db.commit()

		# Re-fetch with relationships eagerly loaded for the response builder.
		stmt = (
			select(Goal)
			.options(
				selectinload(Goal.owner),
				selectinload(Goal.locker),
				selectinload(Goal.goal_sheet),
			)
			.where(Goal.id == goal.id)
		)
		result = await db.execute(stmt)
		return result.scalar_one()

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

		# Capture new snapshot BEFORE snapshot_goal() flushes the session, otherwise
		# server-managed columns (updated_at) get expired and a later getattr would
		# trigger a sync lazy-load inside the async session (MissingGreenlet).
		new_snapshot = goal.to_dict()
		await version_service.snapshot_goal(goal, user, "Employee edited draft", db)
		await event_bus.publish(
			ge.GOAL_UPDATED,
			{
				"goal_id": goal.id,
				"old_snapshot": old_snapshot,
				"new_snapshot": new_snapshot,
				"actor_id": user.id,
				"actor_role": user.role,
			},
			db,
		)
		await db.commit()
		# Re-fetch with relationships eagerly loaded so the response builder can
		# safely access goal.owner / goal.goal_sheet / goal.locker without
		# triggering a sync lazy-load (MissingGreenlet) on the async session.
		stmt = (
			select(Goal)
			.options(
				selectinload(Goal.owner),
				selectinload(Goal.goal_sheet),
				selectinload(Goal.locker),
			)
			.where(Goal.id == goal.id)
		)
		result = await db.execute(stmt)
		return result.scalar_one()

	async def delete_goal(self, goal_id: UUID, user: User, db: AsyncSession) -> None:
		repo = GoalRepository(db)
		goal = await repo.get_or_raise(goal_id)
		if goal.user_id != user.id:
			raise ForbiddenError()
		if goal.status != GoalStatus.DRAFT:
			raise GoalLockedError()
		await repo.soft_delete(goal)
		await event_bus.publish(
			ge.GOAL_DELETED,
			{
				"goal_id": goal.id,
				"actor_id": user.id,
				"actor_role": user.role,
			},
			db,
		)
		await db.commit()

	async def get_my_sheet(self, user: User, cycle_id: UUID, db: AsyncSession) -> GoalSheet | None:
		stmt = (
			select(GoalSheet)
			.options(
				selectinload(GoalSheet.goals).selectinload(Goal.versions),
				selectinload(GoalSheet.goals).selectinload(Goal.owner),
				selectinload(GoalSheet.goals).selectinload(Goal.locker),
				selectinload(GoalSheet.goals).selectinload(Goal.goal_sheet),
				selectinload(GoalSheet.owner),
				selectinload(GoalSheet.approver),
				selectinload(GoalSheet.cycle),
			)
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
