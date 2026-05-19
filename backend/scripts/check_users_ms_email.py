"""Show the most recently created users and all microsoft_email mappings."""
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
        print("=== All users with their email + microsoft_email ===")
        rows = await s.execute(text(
            "SELECT id, full_name, email, microsoft_email, role, created_at "
            "FROM users ORDER BY created_at DESC LIMIT 10"
        ))
        for r in rows.fetchall():
            print(f"  [{r[4]}] {r[1]!r:<25} | email={r[2]} | ms_email={r[3]} | created={str(r[5])[:19]}")

asyncio.run(main())
