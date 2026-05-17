"""Unit tests for the ScoringService Strategy Pattern.

Covers every formula edge case from ``docs/Build_plan_Phase2 (1).md``
Section 3 and Section 7. Pure unit tests — no DB, no I/O.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest

from app.core.constants import UoMType
from app.services.scoring_service import (
	DivisionByZeroError,
	MaxScoringStrategy,
	MinScoringStrategy,
	PENALTY_PER_DAY,
	ScoreResult,
	ScoringService,
	ScoringStrategy,
	TimelineScoringStrategy,
	ZeroScoringStrategy,
)


# ──────────────────────────────────────────────────────────────────────────
# MinScoringStrategy
# ──────────────────────────────────────────────────────────────────────────


class TestMinScoringStrategy:
	def setup_method(self) -> None:
		self.strategy = MinScoringStrategy()

	def test_actual_equals_target_scores_1(self) -> None:
		result = self.strategy.compute(target=100, actual=100)
		assert result.score == Decimal("1")
		assert result.capped is False
		assert result.percentage == "100.00%"
		assert result.formula_used == MinScoringStrategy.formula
		assert result.notes is None

	def test_actual_zero_scores_zero(self) -> None:
		result = self.strategy.compute(target=100, actual=0)
		assert result.score == Decimal("0")
		assert result.percentage == "0.00%"
		assert result.capped is False
		assert result.notes is None

	def test_actual_double_target_scores_2_and_capped(self) -> None:
		result = self.strategy.compute(target=100, actual=200)
		assert result.score == Decimal("2")
		assert result.capped is True
		# Ratio is exactly 2.0, which equals the display cap — no "raw ratio" note.
		assert result.notes is None

	def test_actual_above_display_cap_clamps_and_notes_raw_ratio(self) -> None:
		# 3x target → raw ratio 3.0, clamped to 2.0 for display
		result = self.strategy.compute(target=100, actual=300)
		assert result.score == Decimal("2.0")
		assert result.capped is True
		assert result.notes is not None
		assert "3" in result.notes  # mentions the raw ratio

	def test_target_zero_raises_division_by_zero(self) -> None:
		with pytest.raises(DivisionByZeroError) as exc:
			self.strategy.compute(target=0, actual=50)
		assert "MIN" in exc.value.message

	def test_decimal_precision_no_float_drift(self) -> None:
		# 75.25 / 100.5 — pick numbers where binary float would drift
		result = self.strategy.compute(target=Decimal("100.5"), actual=Decimal("75.25"))
		expected = Decimal("75.25") / Decimal("100.5")
		assert result.score == expected
		# Confirm the result is in Decimal, not float
		assert isinstance(result.score, Decimal)

	def test_actual_none_raises_value_error(self) -> None:
		with pytest.raises(ValueError, match="actual_value cannot be None"):
			self.strategy.compute(target=100, actual=None)

	def test_target_none_raises_value_error(self) -> None:
		with pytest.raises(ValueError, match="target_value cannot be None"):
			self.strategy.compute(target=None, actual=50)


# ──────────────────────────────────────────────────────────────────────────
# MaxScoringStrategy
# ──────────────────────────────────────────────────────────────────────────


class TestMaxScoringStrategy:
	def setup_method(self) -> None:
		self.strategy = MaxScoringStrategy()

	def test_actual_equals_target_scores_exactly_1(self) -> None:
		result = self.strategy.compute(target=50, actual=50)
		assert result.score == Decimal("1")
		assert result.percentage == "100.00%"
		assert result.capped is False
		assert result.notes is None

	def test_actual_zero_returns_1_point_5_with_verify_note(self) -> None:
		result = self.strategy.compute(target=50, actual=0)
		assert result.score == Decimal("1.5")
		assert result.percentage == "150.00%"
		assert result.notes == "Achievement of zero — verify data"
		assert result.capped is False

	def test_actual_double_target_scores_half(self) -> None:
		result = self.strategy.compute(target=50, actual=100)
		assert result.score == Decimal("0.5")
		assert result.percentage == "50.00%"

	def test_target_zero_raises_division_by_zero(self) -> None:
		with pytest.raises(DivisionByZeroError) as exc:
			self.strategy.compute(target=0, actual=5)
		assert "MAX" in exc.value.message


# ──────────────────────────────────────────────────────────────────────────
# TimelineScoringStrategy
# ──────────────────────────────────────────────────────────────────────────


class TestTimelineScoringStrategy:
	def setup_method(self) -> None:
		self.strategy = TimelineScoringStrategy()
		self.target = date(2026, 6, 30)

	def test_actual_five_days_early_scores_1(self) -> None:
		result = self.strategy.compute(
			target=self.target, actual=self.target - timedelta(days=5)
		)
		assert result.score == Decimal("1.0")
		assert result.percentage == "100.00%"
		assert result.capped is False

	def test_actual_exactly_on_target_scores_1(self) -> None:
		result = self.strategy.compute(target=self.target, actual=self.target)
		assert result.score == Decimal("1.0")

	def test_actual_one_day_late_scores_0_95(self) -> None:
		result = self.strategy.compute(
			target=self.target, actual=self.target + timedelta(days=1)
		)
		assert result.score == Decimal("0.95")
		assert result.percentage == "95.00%"
		assert result.notes is not None
		assert "1 day" in result.notes

	def test_actual_twenty_days_late_clamps_to_zero(self) -> None:
		# 1.0 - 20 * 0.05 = 0.0 — exactly at the floor
		result = self.strategy.compute(
			target=self.target, actual=self.target + timedelta(days=20)
		)
		assert result.score == Decimal("0")
		assert result.percentage == "0.00%"

	def test_actual_thirty_days_late_clamps_to_zero_not_negative(self) -> None:
		# Raw would be -0.5; must clamp at 0
		result = self.strategy.compute(
			target=self.target, actual=self.target + timedelta(days=30)
		)
		assert result.score == Decimal("0")
		assert result.score >= Decimal("0")

	def test_no_actual_today_before_target_returns_none(self) -> None:
		result = self.strategy.compute(
			target=self.target,
			actual=None,
			today=self.target - timedelta(days=10),
		)
		assert result.score is None
		assert result.percentage == "N/A"
		assert result.notes is not None
		assert "progress" in result.notes.lower()

	def test_no_actual_today_after_target_scores_zero_overdue(self) -> None:
		result = self.strategy.compute(
			target=self.target,
			actual=None,
			today=self.target + timedelta(days=1),
		)
		assert result.score == Decimal("0")
		assert result.notes is not None
		assert "overdue" in result.notes.lower()

	def test_no_actual_today_equals_target_returns_none(self) -> None:
		# Boundary: today == target_date and no actual — still in-progress
		result = self.strategy.compute(
			target=self.target, actual=None, today=self.target
		)
		assert result.score is None

	def test_missing_target_date_raises_value_error(self) -> None:
		with pytest.raises(ValueError, match="target_date is required"):
			self.strategy.compute(target=None, actual=self.target)

	def test_non_date_target_raises_type_error(self) -> None:
		with pytest.raises(TypeError):
			self.strategy.compute(target="2026-06-30", actual=self.target)

	def test_non_date_actual_raises_type_error(self) -> None:
		with pytest.raises(TypeError):
			self.strategy.compute(target=self.target, actual="2026-07-01")

	def test_custom_penalty_per_day_overrides_default(self) -> None:
		# 5 days late at 0.10/day → score = 0.5
		result = self.strategy.compute(
			target=self.target,
			actual=self.target + timedelta(days=5),
			penalty_per_day=Decimal("0.10"),
		)
		assert result.score == Decimal("0.50")


# ──────────────────────────────────────────────────────────────────────────
# ZeroScoringStrategy
# ──────────────────────────────────────────────────────────────────────────


class TestZeroScoringStrategy:
	def setup_method(self) -> None:
		self.strategy = ZeroScoringStrategy()

	def test_actual_zero_scores_1(self) -> None:
		result = self.strategy.compute(target=0, actual=0)
		assert result.score == Decimal("1.0")
		assert result.percentage == "100.00%"
		assert result.capped is False

	def test_actual_one_scores_0(self) -> None:
		result = self.strategy.compute(target=0, actual=1)
		assert result.score == Decimal("0")
		assert result.percentage == "0.00%"

	def test_actual_zero_point_001_rounds_to_zero_scores_1(self) -> None:
		# round(0.001) == 0 → 100%
		result = self.strategy.compute(target=0, actual=Decimal("0.001"))
		assert result.score == Decimal("1.0")

	def test_actual_zero_point_five_rounds_up_to_one_scores_0(self) -> None:
		# Documented behaviour: ROUND_HALF_UP (NOT banker's rounding).
		# 0.5 rounds to 1, so score is 0.0.
		result = self.strategy.compute(target=0, actual=Decimal("0.5"))
		assert result.score == Decimal("0")

	def test_actual_zero_point_four_nine_nine_rounds_to_zero_scores_1(self) -> None:
		result = self.strategy.compute(target=0, actual=Decimal("0.499"))
		assert result.score == Decimal("1.0")

	def test_negative_actual_handled_gracefully(self) -> None:
		# Pydantic rejects negatives at the schema layer; the service itself
		# must not crash. round(-1) == -1 → score 0.0.
		result = self.strategy.compute(target=0, actual=-1)
		assert result.score == Decimal("0")
		assert result.percentage == "0.00%"


# ──────────────────────────────────────────────────────────────────────────
# ScoringService — Dispatch
# ──────────────────────────────────────────────────────────────────────────


class _RecordingStrategy(ScoringStrategy):
	"""Test double that records the call instead of doing math."""

	def __init__(self, marker: str) -> None:
		self.marker = marker
		self.calls: list[tuple[Any, Any, dict[str, Any]]] = []

	def compute(self, target: Any, actual: Any, **kwargs: Any) -> ScoreResult:
		self.calls.append((target, actual, kwargs))
		return ScoreResult(
			score=Decimal("0"),
			percentage="0.00%",
			formula_used=self.marker,
			notes=None,
			capped=False,
		)


class TestScoringServiceDispatch:
	def test_default_strategies_cover_all_uom_types(self) -> None:
		service = ScoringService()
		for uom in UoMType:
			# Each UoMType must resolve to a strategy
			assert uom in service._strategies  # noqa: SLF001 — test introspection

	def test_dispatch_routes_min(self) -> None:
		mocks = {
			UoMType.MIN: _RecordingStrategy("min"),
			UoMType.MAX: _RecordingStrategy("max"),
			UoMType.TIMELINE: _RecordingStrategy("timeline"),
			UoMType.ZERO: _RecordingStrategy("zero"),
		}
		service = ScoringService(strategies=mocks)
		result = service.compute(UoMType.MIN, target=100, actual=50)
		assert result.formula_used == "min"
		assert len(mocks[UoMType.MIN].calls) == 1
		assert mocks[UoMType.MAX].calls == []
		assert mocks[UoMType.TIMELINE].calls == []
		assert mocks[UoMType.ZERO].calls == []

	def test_dispatch_routes_max(self) -> None:
		mocks = {
			UoMType.MIN: _RecordingStrategy("min"),
			UoMType.MAX: _RecordingStrategy("max"),
			UoMType.TIMELINE: _RecordingStrategy("timeline"),
			UoMType.ZERO: _RecordingStrategy("zero"),
		}
		service = ScoringService(strategies=mocks)
		result = service.compute(UoMType.MAX, target=10, actual=20)
		assert result.formula_used == "max"
		assert len(mocks[UoMType.MAX].calls) == 1

	def test_dispatch_routes_timeline(self) -> None:
		mocks = {
			UoMType.MIN: _RecordingStrategy("min"),
			UoMType.MAX: _RecordingStrategy("max"),
			UoMType.TIMELINE: _RecordingStrategy("timeline"),
			UoMType.ZERO: _RecordingStrategy("zero"),
		}
		service = ScoringService(strategies=mocks)
		result = service.compute(
			UoMType.TIMELINE, target=date(2026, 1, 1), actual=date(2026, 1, 2)
		)
		assert result.formula_used == "timeline"

	def test_dispatch_routes_zero(self) -> None:
		mocks = {
			UoMType.MIN: _RecordingStrategy("min"),
			UoMType.MAX: _RecordingStrategy("max"),
			UoMType.TIMELINE: _RecordingStrategy("timeline"),
			UoMType.ZERO: _RecordingStrategy("zero"),
		}
		service = ScoringService(strategies=mocks)
		result = service.compute(UoMType.ZERO, target=0, actual=0)
		assert result.formula_used == "zero"

	def test_dispatch_forwards_kwargs(self) -> None:
		recorder = _RecordingStrategy("timeline")
		service = ScoringService(strategies={UoMType.TIMELINE: recorder})
		service.compute(
			UoMType.TIMELINE,
			target=date(2026, 1, 1),
			actual=None,
			today=date(2026, 2, 1),
			penalty_per_day=Decimal("0.10"),
		)
		_, _, kwargs = recorder.calls[0]
		assert kwargs["today"] == date(2026, 2, 1)
		assert kwargs["penalty_per_day"] == Decimal("0.10")

	def test_unknown_uom_type_raises_value_error(self) -> None:
		service = ScoringService()

		class _FakeEnum:
			value = "unsupported"

		with pytest.raises(ValueError, match="Unknown UoMType"):
			service.compute(_FakeEnum(), target=1, actual=1)  # type: ignore[arg-type]

	def test_penalty_per_day_constant_is_decimal(self) -> None:
		# Type hygiene — caller-visible constant must be Decimal, not float
		assert isinstance(PENALTY_PER_DAY, Decimal)
		assert PENALTY_PER_DAY == Decimal("0.05")
