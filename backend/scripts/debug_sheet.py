import asyncio, sys
sys.path.insert(0, r"c:\itsMe\AtomQuest\backend")
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.models.goal_sheet import GoalSheet

async def m():
    async with AsyncSessionLocal() as db:
        sid = "bd4c6573-fc3e-4c5c-90f9-d9f7930646a8"
        sheet = (await db.execute(
            select(GoalSheet).where(GoalSheet.id == sid).options(selectinload(GoalSheet.goals))
        )).scalar_one()
        print(f"sheet status={sheet.status} is_deleted={sheet.is_deleted}")
        for g in sheet.goals:
            print(f"  goal id={g.id} status={g.status} is_deleted={g.is_deleted} title={g.title!r}")
asyncio.run(m())
