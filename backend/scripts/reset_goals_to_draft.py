"""
Reset all goals and goal sheets back to DRAFT status.

This is a development utility used to revert the system into its initial
"nothing submitted yet" state without dropping any data:

- Every row in `goals` becomes status = 'draft', locked_at/locked_by cleared.
- Every row in `goal_sheets` becomes status = 'draft', submitted_at /
  approved_at / approved_by cleared, returned_count reset to 0.

Run from the backend/ directory:
    python scripts/reset_goals_to_draft.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.core.database import engine


async def reset_to_draft() -> None:
    async with engine.begin() as conn:
        goal_result = await conn.execute(
            text(
                """
                UPDATE goals
                   SET status = 'draft',
                       locked_at = NULL,
                       locked_by = NULL
                """
            )
        )
        sheet_result = await conn.execute(
            text(
                """
                UPDATE goal_sheets
                   SET status = 'draft',
                       submitted_at = NULL,
                       approved_at = NULL,
                       approved_by = NULL,
                       returned_count = 0
                """
            )
        )
        print(f"goals updated: {goal_result.rowcount}")
        print(f"goal_sheets updated: {sheet_result.rowcount}")
    await engine.dispose()


def main() -> None:
    print("This will set EVERY goal and goal sheet back to DRAFT status.")
    print("Locked/approved data will be cleared. No rows are deleted.")
    answer = input("Type 'yes' to continue: ").strip().lower()
    if answer != "yes":
        print("Aborted.")
        sys.exit(0)
    asyncio.run(reset_to_draft())
    print("Done.")


if __name__ == "__main__":
    main()
