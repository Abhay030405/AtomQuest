import asyncio, sys, traceback
sys.path.insert(0, r"c:\itsMe\AtomQuest\backend")
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.services.approval_service import approval_service

async def main():
    async with AsyncSessionLocal() as db:
        mgr = (await db.execute(select(User).where(User.email == "vikram@atomberg.com"))).scalar_one()
        print(f"mgr id={mgr.id}")
        try:
            sheets = await approval_service.get_pending_approvals(mgr, db)
            print(f"pending count={len(sheets)}")
            for s in sheets:
                print(f"  {s.id} user={s.user_id} status={s.status}")
        except Exception:
            traceback.print_exc()

asyncio.run(main())
