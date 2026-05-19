"""One-off script: link abhayagarwal057@gmail.com → Priya Sharma (admin)."""
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

MICROSOFT_EMAIL = "abhayagarwal057@gmail.com"
PRIYA_EMAIL = "priya@atomberg.com"

async def main():
    async with Session() as s:
        result = await s.execute(
            text(
                "UPDATE users SET microsoft_email = :ms_email "
                "WHERE email = :email "
                "RETURNING id, full_name, microsoft_email"
            ),
            {"ms_email": MICROSOFT_EMAIL, "email": PRIYA_EMAIL},
        )
        row = result.fetchone()
        if row:
            print(f"OK — Updated user: id={row[0]}, name={row[1]}, microsoft_email={row[2]}")
            await s.commit()
        else:
            print("Priya not found. Listing all admins:")
            rows = await s.execute(text("SELECT id, full_name, email FROM users WHERE role = 'admin'"))
            for r in rows.fetchall():
                print(f"  {r}")

asyncio.run(main())
