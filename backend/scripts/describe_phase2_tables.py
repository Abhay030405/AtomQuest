"""One-shot helper: print column/index/constraint summary for Phase 2 tables."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg

from app.core.config import settings


TABLES = [
    "achievements",
    "achievement_versions",
    "checkins",
    "checkin_events",
    "analytics_snapshots",
]


async def main() -> None:
    url = str(settings.database_url).replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        for tbl in TABLES:
            print(f"\n========== {tbl} ==========")
            cols = await conn.fetch(
                """
                SELECT column_name, data_type, udt_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
                """,
                tbl,
            )
            for r in cols:
                print(
                    f"  {r['column_name']:32} {r['data_type']:30} "
                    f"udt={r['udt_name']:26} null={r['is_nullable']:3} "
                    f"default={r['column_default']}"
                )
            idx = await conn.fetch(
                "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 ORDER BY indexname",
                tbl,
            )
            print("  -- indexes --")
            for i in idx:
                print(f"  {i['indexname']}: {i['indexdef']}")
            cons = await conn.fetch(
                """
                SELECT conname, pg_get_constraintdef(oid) AS def
                FROM pg_constraint
                WHERE conrelid = $1::regclass AND contype IN ('f','u','p')
                ORDER BY contype, conname
                """,
                tbl,
            )
            print("  -- constraints (pk/fk/unique) --")
            for f in cons:
                print(f"  {f['conname']}: {f['def']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
