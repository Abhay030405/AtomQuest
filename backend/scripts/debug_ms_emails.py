"""Find auto-provisioned user and all ms_email mappings."""
import asyncio, os
from dotenv import load_dotenv
load_dotenv()
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

_INCOMPATIBLE = {"sslmode", "channel_binding", "ssl", "options"}

def _clean(url: str) -> str:
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break
    parsed = urlparse(url)
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    for p in _INCOMPATIBLE:
        params.pop(p, None)
    return urlunparse(parsed._replace(query=urlencode(params)))

engine = create_async_engine(_clean(os.environ["DATABASE_URL"]))
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with Session() as s:
        count = (await s.execute(text("SELECT COUNT(*) FROM users"))).scalar()
        print(f"Total users: {count}")
        print()

        print("=== Users with microsoft_email set ===")
        rows = await s.execute(text(
            "SELECT email, microsoft_email, role, full_name FROM users "
            "WHERE microsoft_email IS NOT NULL ORDER BY created_at DESC"
        ))
        for r in rows.fetchall():
            print(f"  [{r[2]}] {r[3]!r} | email={r[0]} | ms_email={r[1]}")

        print()
        print("=== Newest 15 users ===")
        rows = await s.execute(text(
            "SELECT email, microsoft_email, role, full_name, created_at FROM users "
            "ORDER BY created_at DESC LIMIT 15"
        ))
        for r in rows.fetchall():
            print(f"  [{r[2]}] {r[3]!r:<22} | email={r[0]} | ms={r[1]} | {str(r[4])[:19]}")

asyncio.run(main())
