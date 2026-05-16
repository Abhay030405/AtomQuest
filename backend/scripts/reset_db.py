"""
Reset script — drops all tables then re-seeds with demo data.
FOR DEVELOPMENT USE ONLY.
Run from the backend/ directory:  python scripts/reset_db.py
"""
from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base, engine


async def drop_all_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def main() -> None:
    print("WARNING: This will DROP ALL TABLES and reseed with demo data.")
    print("This action is irreversible. Only use in development environments.")
    answer = input("Type 'yes' to continue: ").strip().lower()
    if answer != "yes":
        print("Aborted.")
        sys.exit(0)

    print("Dropping all tables...")
    asyncio.run(drop_all_tables())
    print("All tables dropped.")

    print("Running migrations...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=Path(__file__).parent.parent,
        check=False,
    )
    if result.returncode != 0:
        print("Migration failed — aborting seed.")
        sys.exit(1)

    print("Seeding database...")
    seed_script = Path(__file__).parent / "seed_data.py"
    result = subprocess.run(
        [sys.executable, str(seed_script)],
        cwd=Path(__file__).parent.parent,
        check=False,
    )
    if result.returncode != 0:
        print("Seed failed.")
        sys.exit(1)

    print("Reset complete.")


if __name__ == "__main__":
    main()
