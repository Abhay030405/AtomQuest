from __future__ import annotations

from typing import Any, Optional

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status


class AtomQuestException(Exception):
	def __init__(
		self,
		code: str,
		message: str,
		status_code: int,
		field: Optional[str] = None,
	) -> None:
		super().__init__(message)
		self.code = code
		self.message = message
		self.status_code = status_code
		self.field = field


class GoalNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("GOAL_NOT_FOUND", "Goal not found", status.HTTP_404_NOT_FOUND)


class GoalSheetNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("GOAL_SHEET_NOT_FOUND", "Goal sheet not found", status.HTTP_404_NOT_FOUND)


class UnauthorizedError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("UNAUTHORIZED", "Authentication required", status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("FORBIDDEN", "You don't have permission to perform this action", status.HTTP_403_FORBIDDEN)


class GoalLockedError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("GOAL_LOCKED", "This goal is locked and cannot be modified", status.HTTP_403_FORBIDDEN)


class WindowClosedError(AtomQuestException):
	def __init__(self, next_opening: str) -> None:
		message = f"Goal window is closed. Next window opens at {next_opening}"
		super().__init__("WINDOW_CLOSED", message, status.HTTP_403_FORBIDDEN)


class WeightageError(AtomQuestException):
	def __init__(self, message: str = "Total weightage must equal 100%", code: str = "WEIGHTAGE_ERROR") -> None:
		super().__init__(code, message, status.HTTP_422_UNPROCESSABLE_ENTITY)


class GoalCountError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"GOAL_COUNT_ERROR",
			"Maximum 8 goals allowed per employee per cycle",
			status.HTTP_422_UNPROCESSABLE_ENTITY,
		)


class MinWeightageError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"MIN_WEIGHTAGE_ERROR",
			"Each goal must have at least 10% weightage",
			status.HTTP_422_UNPROCESSABLE_ENTITY,
		)


class InvalidStateTransitionError(AtomQuestException):
	def __init__(self, current_state: str, attempted_state: str) -> None:
		message = f"Invalid state transition from {current_state} to {attempted_state}"
		super().__init__(
			"INVALID_STATE_TRANSITION",
			message,
			status.HTTP_422_UNPROCESSABLE_ENTITY,
		)


class DuplicateGoalSheetError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"DUPLICATE_GOAL_SHEET",
			"You already have a goal sheet for this cycle",
			status.HTTP_409_CONFLICT,
		)


class UserNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("USER_NOT_FOUND", "User not found", status.HTTP_404_NOT_FOUND)


class CycleNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("CYCLE_NOT_FOUND", "No active cycle configuration found", status.HTTP_404_NOT_FOUND)


class InvalidCredentialsError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__("INVALID_CREDENTIALS", "Invalid email or password", status.HTTP_401_UNAUTHORIZED)


# Phase 2 — Achievement ledger ---------------------------------------------


class AchievementNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"ACHIEVEMENT_NOT_FOUND",
			"Achievement not found",
			status.HTTP_404_NOT_FOUND,
		)


class DuplicateAchievementError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"DUPLICATE_ACHIEVEMENT",
			"An achievement already exists for this goal and quarter. Use resubmit to update.",
			status.HTTP_409_CONFLICT,
		)


class SharedGoalAchievementError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"MANAGED_BY_GOAL_OWNER",
			"Managed by the goal owner — achievement is synced from the upstream shared goal.",
			status.HTTP_403_FORBIDDEN,
		)


class GoalNotLockedError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"GOAL_NOT_LOCKED",
			"Achievements can only be logged against locked goals",
			status.HTTP_422_UNPROCESSABLE_ENTITY,
		)


class BulkValidationFailedError(AtomQuestException):
	def __init__(self, errors: list[dict[str, Any]]) -> None:
		super().__init__(
			"BULK_VALIDATION_FAILED",
			f"{len(errors)} achievement(s) failed validation; no rows were written.",
			status.HTTP_422_UNPROCESSABLE_ENTITY,
		)
		self.errors = errors


# Phase 2 — Manager check-ins

class CheckinNotFoundError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"CHECKIN_NOT_FOUND",
			"Check-in not found",
			status.HTTP_404_NOT_FOUND,
		)


class DuplicateCheckinError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"DUPLICATE_CHECKIN",
			"A check-in already exists for this employee in this quarter and cycle. Use PATCH to amend.",
			status.HTTP_409_CONFLICT,
		)


class InvalidCheckinCommentError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"INVALID_CHECKIN_COMMENT",
			"Check-in comment must be at least 20 characters.",
			status.HTTP_400_BAD_REQUEST,
		)


class NotInTeamError(AtomQuestException):
	def __init__(self) -> None:
		super().__init__(
			"NOT_IN_TEAM",
			"Employee is not in your direct reports.",
			status.HTTP_403_FORBIDDEN,
		)



def _build_error_response(code: str, message: str, field: Optional[str]) -> dict[str, Any]:
	return {
		"success": False,
		"data": None,
		"error": {
			"code": code,
			"message": message,
			"field": field,
		},
		"meta": None,
	}


def atomquest_exception_handler(_: Request, exc: AtomQuestException) -> JSONResponse:
	payload = _build_error_response(exc.code, exc.message, exc.field)
	# Bulk validation surfaces a `details` list of per-row errors for clients.
	if isinstance(exc, BulkValidationFailedError):
		payload["error"]["details"] = exc.errors
	return JSONResponse(status_code=exc.status_code, content=payload)


def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
	field: Optional[str] = None
	if exc.errors():
		loc = exc.errors()[0].get("loc", [])
		field = ".".join(str(item) for item in loc if item != "body") or None
	payload = _build_error_response("VALIDATION_ERROR", "Validation error", field)
	return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=payload)
