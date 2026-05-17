"""Scoring Service — pure, stateless formula engine.

Implements the Strategy Pattern (one class per UoM type) plus a thin
``ScoringService`` context that dispatches to the right strategy. Zero DB
calls, zero HTTP calls, zero side effects — every input is a parameter and
every output is a ``ScoreResult``.

See ``docs/Build_plan_Phase2 (1).md`` Section 3 and ``docs/scoring-formulas.md``
for the business rules. The Open/Closed Principle is the design driver:
adding a new UoM type requires exactly one new class + one dict entry.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Mapping, Optional

from app.core.constants import UoMType
from app.core.exceptions import AtomQuestException


# ── Domain types ────────────────────────────────────────────────────────────


class DivisionByZeroError(AtomQuestException):
	"""Raised when a scoring formula would divide by zero."""

	def __init__(self, message: str = "Target cannot be zero") -> None:
		super().__init__(
			code="DIVISION_BY_ZERO",
			message=message,
			status_code=422,
		)


@dataclass(frozen=True)
class ScoreResult:
	"""Immutable scoring outcome.

	``score`` is ``None`` only for legitimately-incomplete timeline goals
	(window still open, no actual_date submitted). All numeric scores are
	``Decimal`` to avoid float drift in persistence and aggregation.
	"""

	score: Optional[Decimal]
	percentage: str
	formula_used: str
	notes: Optional[str] = None
	capped: bool = False


# ── Constants ───────────────────────────────────────────────────────────────


# Display-time clamp for over-achievement on MIN goals. The raw ratio is
# preserved up to this ceiling; anything beyond is reported as 2.0 with the
# ``capped`` flag set so the UI can show a "200%+" badge.
_MAX_DISPLAY_SCORE: Decimal = Decimal("2.0")
_ONE: Decimal = Decimal("1.0")
_ZERO: Decimal = Decimal("0")
_OVER_ACHIEVEMENT_MAX: Decimal = Decimal("1.5")
# Default daily penalty for TIMELINE lateness. Configurable per cycle via
# ``cycle_config.scoring_overrides`` once Phase 2.5 ships; for now it is a
# module-level default that the caller may override via the ``penalty_per_day``
# kwarg passed through ``ScoringService.compute``.
PENALTY_PER_DAY: Decimal = Decimal("0.05")


def _percentage(score: Optional[Decimal]) -> str:
	"""Render a score as a two-decimal percentage string. ``None`` → ``"N/A"``."""
	if score is None:
		return "N/A"
	pct = (score * Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
	return f"{pct}%"


def _to_decimal(value: Any, *, field: str) -> Decimal:
	"""Coerce numeric input to ``Decimal``. ``None`` raises ``ValueError``."""
	if value is None:
		raise ValueError(f"{field} cannot be None")
	if isinstance(value, Decimal):
		return value
	# str() detour avoids float-binary drift (e.g. Decimal(0.1) != Decimal("0.1"))
	return Decimal(str(value))


# ── Strategy Pattern ────────────────────────────────────────────────────────


class ScoringStrategy(ABC):
	"""Abstract base — every UoM type implements this contract."""

	@abstractmethod
	def compute(
		self, target: Any, actual: Any, **kwargs: Any
	) -> ScoreResult: ...


class MinScoringStrategy(ScoringStrategy):
	"""Higher is better. ``score = actual / target``."""

	formula = "score = actual_value / target_value"

	def compute(self, target: Any, actual: Any, **kwargs: Any) -> ScoreResult:
		target_d = _to_decimal(target, field="target_value")
		actual_d = _to_decimal(actual, field="actual_value")
		if target_d == _ZERO:
			raise DivisionByZeroError(
				"Target cannot be zero for MIN type"
			)
		ratio = actual_d / target_d
		capped = ratio > _ONE
		score = ratio if ratio <= _MAX_DISPLAY_SCORE else _MAX_DISPLAY_SCORE
		notes: Optional[str] = None
		if ratio > _MAX_DISPLAY_SCORE:
			notes = f"Display capped at {_MAX_DISPLAY_SCORE}; raw ratio = {ratio}"
		return ScoreResult(
			score=score,
			percentage=_percentage(score),
			formula_used=self.formula,
			notes=notes,
			capped=capped,
		)


class MaxScoringStrategy(ScoringStrategy):
	"""Lower is better. ``score = target / actual``."""

	formula = "score = target_value / actual_value"

	def compute(self, target: Any, actual: Any, **kwargs: Any) -> ScoreResult:
		target_d = _to_decimal(target, field="target_value")
		actual_d = _to_decimal(actual, field="actual_value")
		if target_d == _ZERO:
			# Defensive guard — a MAX goal with target=0 is degenerate
			# (cannot quantify "lower than zero" for defect counts).
			raise DivisionByZeroError(
				"Target cannot be zero for MAX type"
			)
		if actual_d == _ZERO:
			# Achieved literal zero — counts as 150% per spec but flagged
			# so reviewers can sanity-check the data entry.
			return ScoreResult(
				score=_OVER_ACHIEVEMENT_MAX,
				percentage=_percentage(_OVER_ACHIEVEMENT_MAX),
				formula_used=self.formula,
				notes="Achievement of zero — verify data",
				capped=False,
			)
		score = target_d / actual_d
		return ScoreResult(
			score=score,
			percentage=_percentage(score),
			formula_used=self.formula,
			notes=None,
			capped=False,
		)


class TimelineScoringStrategy(ScoringStrategy):
	"""Date-based.

	``target`` and ``actual`` here are ``date`` objects (target_date and
	actual_date respectively). The caller may pass ``today`` and
	``penalty_per_day`` as kwargs; both default to module-level constants.
	"""

	formula = (
		"on time → 1.0; late → max(0, 1.0 - days_late * PENALTY_PER_DAY)"
	)

	def compute(self, target: Any, actual: Any, **kwargs: Any) -> ScoreResult:
		target_date = target
		actual_date = actual
		if target_date is None:
			raise ValueError("target_date is required for TIMELINE type")
		if not isinstance(target_date, date):
			raise TypeError("target_date must be a date instance")
		if actual_date is not None and not isinstance(actual_date, date):
			raise TypeError("actual_date must be a date instance or None")

		today: date = kwargs.get("today") or date.today()
		penalty: Decimal = _to_decimal(
			kwargs.get("penalty_per_day", PENALTY_PER_DAY),
			field="penalty_per_day",
		)

		if actual_date is None:
			if today <= target_date:
				# Window still open — no score yet.
				return ScoreResult(
					score=None,
					percentage=_percentage(None),
					formula_used=self.formula,
					notes="In progress — target date not yet reached",
					capped=False,
				)
			# Window has passed without an actual_date — overdue.
			return ScoreResult(
				score=_ZERO,
				percentage=_percentage(_ZERO),
				formula_used=self.formula,
				notes="Overdue — no actual date recorded",
				capped=False,
			)

		if actual_date <= target_date:
			return ScoreResult(
				score=_ONE,
				percentage=_percentage(_ONE),
				formula_used=self.formula,
				notes=None,
				capped=False,
			)

		days_late = (actual_date - target_date).days
		raw = _ONE - (Decimal(days_late) * penalty)
		score = raw if raw > _ZERO else _ZERO
		notes = f"{days_late} day(s) late" if score > _ZERO else (
			f"{days_late} day(s) late — penalty floor reached"
		)
		return ScoreResult(
			score=score,
			percentage=_percentage(score),
			formula_used=self.formula,
			notes=notes,
			capped=False,
		)


class ZeroScoringStrategy(ScoringStrategy):
	"""Zero = success. Binary: ``round(actual) == 0`` → 1.0 else 0.0.

	Uses ``Decimal.quantize(..., ROUND_HALF_UP)`` so 0.5 → 1 (not banker's
	rounding); spec says floats like 0.001 round to 0 and become 100%.
	Negative values are rejected at the Pydantic layer; here we handle them
	gracefully — ``round(-1) == -1`` so they score 0.0.
	"""

	formula = "round(actual_value) == 0 → 1.0 else 0.0"

	def compute(self, target: Any, actual: Any, **kwargs: Any) -> ScoreResult:
		actual_d = _to_decimal(actual, field="actual_value")
		rounded = actual_d.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
		if rounded == _ZERO:
			return ScoreResult(
				score=_ONE,
				percentage=_percentage(_ONE),
				formula_used=self.formula,
				notes=None,
				capped=False,
			)
		return ScoreResult(
			score=_ZERO,
			percentage=_percentage(_ZERO),
			formula_used=self.formula,
			notes=None,
			capped=False,
		)


# ── Context ─────────────────────────────────────────────────────────────────


class ScoringService:
	"""Strategy dispatcher.

	One singleton instance is typically enough since strategies are
	stateless, but the constructor accepts an injected mapping for tests
	that want to verify dispatch with mock strategies.
	"""

	_DEFAULT_STRATEGIES: Mapping[UoMType, ScoringStrategy] = {
		UoMType.MIN: MinScoringStrategy(),
		UoMType.MAX: MaxScoringStrategy(),
		UoMType.TIMELINE: TimelineScoringStrategy(),
		UoMType.ZERO: ZeroScoringStrategy(),
	}

	def __init__(
		self,
		strategies: Optional[Mapping[UoMType, ScoringStrategy]] = None,
	) -> None:
		self._strategies: Mapping[UoMType, ScoringStrategy] = (
			strategies if strategies is not None else self._DEFAULT_STRATEGIES
		)

	def compute(
		self,
		uom_type: UoMType,
		target: Any,
		actual: Any,
		**kwargs: Any,
	) -> ScoreResult:
		try:
			strategy = self._strategies[uom_type]
		except KeyError as exc:
			raise ValueError(f"Unknown UoMType: {uom_type!r}") from exc
		return strategy.compute(target, actual, **kwargs)


__all__ = [
	"DivisionByZeroError",
	"MaxScoringStrategy",
	"MinScoringStrategy",
	"PENALTY_PER_DAY",
	"ScoreResult",
	"ScoringService",
	"ScoringStrategy",
	"TimelineScoringStrategy",
	"ZeroScoringStrategy",
	"scoring_service",
]


# Module-level stateless singleton mirroring the rest of the service layer.
scoring_service = ScoringService()
