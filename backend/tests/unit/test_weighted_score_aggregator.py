"""Unit tests for ``WeightedScoreAggregator`` — build plan §6.5.

Pure data-structure tests: no DB, no async, no fixtures. Only the public
contract is asserted: ``add``, ``compute``, ``completion_rate``.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.utils.weighted_score_aggregator import WeightedScoreAggregator


# ---------------------------------------------------------------------------
# compute()
# ---------------------------------------------------------------------------


def test_compute_returns_none_when_no_goals_added():
	agg = WeightedScoreAggregator()
	assert agg.compute() is None
	assert agg.completion_rate() == Decimal("0")


def test_compute_returns_none_when_all_scores_are_none():
	agg = WeightedScoreAggregator()
	agg.add(None, Decimal("30"))
	agg.add(None, Decimal("70"))
	assert agg.compute() is None
	assert agg.completion_rate() == Decimal("0")


def test_compute_single_scored_goal():
	agg = WeightedScoreAggregator()
	agg.add(Decimal("0.8"), Decimal("100"))
	# Single scored goal — weighted average collapses to its score.
	assert agg.compute() == Decimal("0.8")
	assert agg.completion_rate() == Decimal("1")


def test_compute_mixed_none_and_scored_excludes_unscored_from_average():
	agg = WeightedScoreAggregator()
	agg.add(Decimal("1.0"), Decimal("50"))   # scored
	agg.add(None, Decimal("30"))             # not yet scored — excluded
	agg.add(Decimal("0.5"), Decimal("20"))   # scored
	# Σ(score × w) / Σ(w) over scored only = (1.0*50 + 0.5*20) / (50 + 20) = 60/70
	expected = (Decimal("1.0") * Decimal("50") + Decimal("0.5") * Decimal("20")) / Decimal("70")
	assert agg.compute() == expected
	assert agg.completion_rate() == Decimal("2") / Decimal("3")


def test_compute_weightages_not_summing_to_100():
	"""Aggregator must not assume weightages total 100 — it normalises by
	the actual weight sum of scored goals."""
	agg = WeightedScoreAggregator()
	agg.add(Decimal("0.6"), Decimal("40"))
	agg.add(Decimal("0.9"), Decimal("10"))
	# Σw = 50 (not 100). Average = (0.6*40 + 0.9*10) / 50 = 33/50 = 0.66
	assert agg.compute() == Decimal("0.66")


def test_compute_preserves_decimal_precision():
	agg = WeightedScoreAggregator()
	agg.add(Decimal("0.3333"), Decimal("33.33"))
	agg.add(Decimal("0.6667"), Decimal("66.67"))
	result = agg.compute()
	expected = (
		Decimal("0.3333") * Decimal("33.33") + Decimal("0.6667") * Decimal("66.67")
	) / (Decimal("33.33") + Decimal("66.67"))
	# Exact Decimal equality — no float drift.
	assert result == expected


# ---------------------------------------------------------------------------
# Input coercion
# ---------------------------------------------------------------------------


def test_add_coerces_non_decimal_inputs_via_str():
	agg = WeightedScoreAggregator()
	agg.add(0.5, 25)
	agg.add("0.75", "75")
	result = agg.compute()
	assert isinstance(result, Decimal)
	# str() coercion avoids float-binary drift.
	expected = (Decimal("0.5") * Decimal("25") + Decimal("0.75") * Decimal("75")) / Decimal("100")
	assert result == expected


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_all_zero_weights_returns_none():
	"""Degenerate but legal: every scored goal had zero weightage."""
	agg = WeightedScoreAggregator()
	agg.add(Decimal("1.0"), Decimal("0"))
	agg.add(Decimal("0.5"), Decimal("0"))
	assert agg.compute() is None
	# But completion_rate still reflects 2/2 scored.
	assert agg.completion_rate() == Decimal("1")


def test_completion_rate_with_partial_scoring():
	agg = WeightedScoreAggregator()
	agg.add(Decimal("0.5"), Decimal("20"))
	agg.add(None, Decimal("30"))
	agg.add(None, Decimal("50"))
	# 1 of 3 scored.
	assert agg.completion_rate() == Decimal("1") / Decimal("3")


def test_score_of_zero_counts_as_scored():
	"""``score=0`` is a real outcome (e.g. ZERO-UoM achievement of >0). It
	must NOT be conflated with ``score=None`` (not yet scored)."""
	agg = WeightedScoreAggregator()
	agg.add(Decimal("0"), Decimal("50"))
	agg.add(Decimal("1.0"), Decimal("50"))
	assert agg.compute() == Decimal("0.5")
	assert agg.completion_rate() == Decimal("1")
