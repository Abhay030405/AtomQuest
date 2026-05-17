import asyncio, sys
sys.path.insert(0, r"c:\itsMe\AtomQuest\backend")
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def m():
    async with AsyncSessionLocal() as db:
        # Postgres requires ALTER TYPE ADD VALUE to be outside a transaction block
        # for older PG; PG 12+ allows it inside. AsyncSessionLocal opens a tx.
        # Run with isolation autocommit via engine.
        from app.core.database import engine
        async with engine.connect() as conn:
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            await conn.execute(text("ALTER TYPE goal_sheet_status ADD VALUE IF NOT EXISTS 'under_review'"))
            print("OK: added 'under_review' to goal_sheet_status enum")
        # verify
        async with AsyncSessionLocal() as db2:
            r = await db2.execute(text("SELECT unnest(enum_range(NULL::goal_sheet_status))::text"))
            print("PG goal_sheet_status now:", [row[0] for row in r.all()])

asyncio.run(m())
