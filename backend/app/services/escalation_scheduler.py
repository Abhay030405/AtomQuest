"""APScheduler-based background scheduler for the escalation engine.

The scheduler is started once when the FastAPI app starts up and shut down
cleanly when the app shuts down.  It fires ``escalation_engine.run()`` every
hour by default (configurable via ``ESCALATION_INTERVAL_MINUTES`` in settings).

A manual "Run Now" trigger is also available: call ``run_now()`` from the
Admin API endpoint to execute the engine immediately in a fresh session.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.services.escalation_engine import escalation_engine


logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _run_escalation_job() -> None:
    """Periodic job: open a fresh DB session, run the engine, commit."""
    async with AsyncSessionLocal() as db:
        async with db.begin():
            try:
                result = await escalation_engine.run(db)
                logger.info(
                    "escalation_job_done",
                    rules_evaluated=result.rules_evaluated,
                    notifications_sent=result.notifications_sent,
                    errors=result.errors,
                )
            except Exception as exc:  # pragma: no cover
                logger.error("escalation_job_failed", error=str(exc))
                raise


def start_scheduler(interval_minutes: int = 60) -> None:
    """Start the background scheduler.  Safe to call multiple times (idempotent)."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_escalation_job,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="escalation_engine",
        name="Escalation Engine",
        replace_existing=True,
        next_run_time=None,  # don't fire immediately on startup
    )
    _scheduler.start()
    logger.info("escalation_scheduler_started", interval_minutes=interval_minutes)


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler on app shutdown."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("escalation_scheduler_stopped")
    _scheduler = None


async def run_now() -> None:
    """Trigger an immediate escalation run (used by the Admin 'Run Now' endpoint)."""
    await _run_escalation_job()
