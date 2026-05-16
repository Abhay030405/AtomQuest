from __future__ import annotations

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from app.core.constants import CyclePhase

if TYPE_CHECKING:
    from app.models.cycle_config import CycleConfig


def quarter_from_date(d: date) -> CyclePhase:
    month = d.month
    if month <= 3:
        return CyclePhase.Q1
    elif month <= 6:
        return CyclePhase.Q2
    elif month <= 9:
        return CyclePhase.Q3
    return CyclePhase.Q4


def is_in_window(window_open: datetime, window_close: datetime) -> bool:
    now = datetime.now(timezone.utc)
    open_aware = window_open if window_open.tzinfo else window_open.replace(tzinfo=timezone.utc)
    close_aware = window_close if window_close.tzinfo else window_close.replace(tzinfo=timezone.utc)
    return open_aware <= now <= close_aware


def days_until_close(window_close: datetime) -> int:
    now = datetime.now(timezone.utc)
    close_aware = window_close if window_close.tzinfo else window_close.replace(tzinfo=timezone.utc)
    delta = close_aware - now
    return max(0, delta.days)


def format_window_message(cycle: "CycleConfig") -> str:
    remaining = days_until_close(cycle.window_close)
    open_aware = cycle.window_open if cycle.window_open.tzinfo else cycle.window_open.replace(tzinfo=timezone.utc)
    close_aware = cycle.window_close if cycle.window_close.tzinfo else cycle.window_close.replace(tzinfo=timezone.utc)

    open_str = open_aware.strftime("%d %b %Y")
    close_str = close_aware.strftime("%d %b %Y")

    if remaining == 0:
        return f"Goal-setting window for {cycle.cycle_name} closes today ({close_str})."
    return (
        f"Goal-setting window for {cycle.cycle_name} is open from {open_str} to {close_str}. "
        f"{remaining} day(s) remaining."
    )
