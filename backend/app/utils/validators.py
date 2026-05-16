from __future__ import annotations

from decimal import Decimal
from typing import Sequence, TYPE_CHECKING

from app.core.constants import GoalStatus
from app.services.goal_service import ValidationError, ValidationResult

if TYPE_CHECKING:
    from app.models.goal import Goal

_MIN_GOALS = 3
_MAX_GOALS = 8
_MIN_WEIGHTAGE = Decimal("10.00")
_TOTAL_WEIGHTAGE = Decimal("100.00")


def validate_weightage_sum(goals: Sequence["Goal"]) -> ValidationResult:
    total = sum((g.weightage for g in goals), Decimal("0.00"))
    if total != _TOTAL_WEIGHTAGE:
        return ValidationResult(
            is_valid=False,
            errors=[
                ValidationError(
                    code="WEIGHTAGE_SUM_INVALID",
                    message=f"Total weightage must be 100%. Current total: {total}%.",
                )
            ],
        )
    return ValidationResult(is_valid=True, errors=[])


def validate_goal_count(goals: Sequence["Goal"]) -> ValidationResult:
    count = len(goals)
    if count < _MIN_GOALS or count > _MAX_GOALS:
        return ValidationResult(
            is_valid=False,
            errors=[
                ValidationError(
                    code="GOAL_COUNT_INVALID",
                    message=f"A goal sheet must have between {_MIN_GOALS} and {_MAX_GOALS} goals. Found: {count}.",
                )
            ],
        )
    return ValidationResult(is_valid=True, errors=[])


def validate_min_weightage(goals: Sequence["Goal"]) -> ValidationResult:
    violations = [g for g in goals if g.weightage < _MIN_WEIGHTAGE]
    if violations:
        titles = ", ".join(f'"{g.title}"' for g in violations)
        return ValidationResult(
            is_valid=False,
            errors=[
                ValidationError(
                    code="MIN_WEIGHTAGE_VIOLATED",
                    message=f"Each goal must have at least {_MIN_WEIGHTAGE}% weightage. Violations: {titles}.",
                )
            ],
        )
    return ValidationResult(is_valid=True, errors=[])


def validate_all_draft(goals: Sequence["Goal"]) -> ValidationResult:
    non_draft = [g for g in goals if g.status != GoalStatus.DRAFT]
    if non_draft:
        titles = ", ".join(f'"{g.title}"' for g in non_draft)
        return ValidationResult(
            is_valid=False,
            errors=[
                ValidationError(
                    code="NON_DRAFT_GOALS_PRESENT",
                    message=f"All goals must be in DRAFT status before submission. Non-draft: {titles}.",
                )
            ],
        )
    return ValidationResult(is_valid=True, errors=[])


def run_sheet_validations(goals: Sequence["Goal"]) -> ValidationResult:
    all_errors: list[ValidationError] = []
    for check in (
        validate_goal_count,
        validate_min_weightage,
        validate_weightage_sum,
        validate_all_draft,
    ):
        result = check(goals)
        if not result.is_valid:
            all_errors.extend(result.errors)
    return ValidationResult(is_valid=len(all_errors) == 0, errors=all_errors)
