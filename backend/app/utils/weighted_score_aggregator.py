"""Weighted score aggregator — build plan §6.5.

Pure data structure. Zero DB calls, zero side effects. Used by
``SnapshotUpdateHandler`` to recompute ``weighted_score`` from the live
achievement set for a (user, quarter, cycle).

Contract:

  * ``add(score, weightage)`` — register one goal's contribution. ``score=None``
    means "no achievement scored yet"; it counts toward ``completion_rate``'s
    denominator but is excluded from the weighted average.
  * ``compute()`` — weighted average over goals with a non-null score:

        Σ(score × weightage)   for goals where score is not None
        ─────────────────────
        Σ(weightage)           for those same goals

    Returns ``None`` when no goal has scored — the snapshot table stores
    NULL rather than zero, which would misleadingly imply "scored zero".

  * ``completion_rate()`` — ``scored_count / total_count`` as a Decimal in
    [0.0, 1.0]. Returns ``Decimal("0")`` when total is zero.

All arithmetic uses ``Decimal`` to avoid binary-float drift in persistence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional


_ZERO = Decimal("0")


@dataclass
class WeightedScoreAggregator:
	"""Mutable accumulator. Build per request, drop after ``compute()``."""

	_total_count: int = 0
	_scored_pairs: list[tuple[Decimal, Decimal]] = field(default_factory=list)

	def add(self, score: Optional[Decimal], weightage: Decimal) -> None:
		"""Register one goal. ``score=None`` counts toward total but not the average."""
		if not isinstance(weightage, Decimal):
			weightage = Decimal(str(weightage))
		self._total_count += 1
		if score is None:
			return
		if not isinstance(score, Decimal):
			score = Decimal(str(score))
		self._scored_pairs.append((score, weightage))

	def compute(self) -> Optional[Decimal]:
		"""Weighted average over scored goals. ``None`` when nothing has scored."""
		if not self._scored_pairs:
			return None
		weight_sum = sum((w for _, w in self._scored_pairs), _ZERO)
		if weight_sum == _ZERO:
			# Degenerate but legal — every scored goal had zero weight.
			return None
		score_sum = sum((s * w for s, w in self._scored_pairs), _ZERO)
		return score_sum / weight_sum

	def completion_rate(self) -> Decimal:
		"""Fraction of goals with a non-null score."""
		if self._total_count == 0:
			return _ZERO
		return Decimal(len(self._scored_pairs)) / Decimal(self._total_count)


__all__ = ["WeightedScoreAggregator"]
