import asyncio, sys
sys.path.insert(0, r"c:\itsMe\AtomQuest\backend")
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def m():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT unnest(enum_range(NULL::goal_sheet_status))::text"))
        print("PG goal_sheet_status:", [row[0] for row in r.all()])
asyncio.run(m())
