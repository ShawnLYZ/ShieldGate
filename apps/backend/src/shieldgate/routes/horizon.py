import asyncpg
import httpx
from fastapi import APIRouter, Depends

from shieldgate.db import get_pool
from shieldgate.horizon import refresh_watch
from shieldgate.jwt_auth import AuthUser, require_role, require_user

router = APIRouter(tags=["horizon"])


async def _http_get(url: str) -> str:
    async with httpx.AsyncClient(timeout=8.0) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.text


@router.post("/watch/refresh")
async def refresh(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    async with pool.acquire() as conn:
        n = await refresh_watch(conn, _http_get)
    return {"new_items": n}


@router.get("/watch")
async def list_watch(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    rows = await pool.fetch("select * from public.watch_items order by published_at desc nulls last")
    return [{"id": str(r["id"]), "source": r["source"], "title": r["title"], "url": r["url"],
             "matched_tags": r["matched_tags"], "status": r["status"],
             "published_at": r["published_at"].isoformat() if r["published_at"] else None} for r in rows]
