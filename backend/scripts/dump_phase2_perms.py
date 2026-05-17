"""One-shot helper: dump Phase 2 role_permissions rows."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg

from app.core.config import settings

PHASE2 = (
    "log_achievement",
    "resubmit_achievement",
    "conduct_checkin",
    "edit_checkin",
    "acknowledge_checkin",
    "view_analytics",
    "export_achievement_report",
)


async def main() -> None:
    url = str(settings.database_url).replace("+asyncpg", "")
    conn = await asyncpg.connect(url, statement_cache_size=0)
    try:
        rows = await conn.fetch(
            "SELECT role::text AS role, permission_key FROM role_permissions "
            "WHERE permission_key = ANY($1::text[]) ORDER BY role, permission_key",
            list(PHASE2),
        )
        print(f"Phase 2 role_permissions rows: {len(rows)}")
        for r in rows:
            print(f"  {r['role']:10} -> {r['permission_key']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
