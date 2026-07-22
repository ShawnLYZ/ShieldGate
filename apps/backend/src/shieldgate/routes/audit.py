import csv
import io

import asyncpg
from fastapi import APIRouter, Depends, Query, Request, Response

from shieldgate.audit.chain import verify_chain
from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_role, require_user

router = APIRouter(tags=["audit"])


def _scope(user: AuthUser):
    if user.role == "admin":
        return "", []
    if user.role == "manager":
        return "where department = $1", [user.department]
    return "where false", []


@router.get("/audit")
async def list_audit(request: Request, user: AuthUser = Depends(require_user),
                     pool: asyncpg.Pool = Depends(get_pool),
                     event_type: str | None = Query(None), limit: int = Query(100, le=500),
                     offset: int = Query(0)):
    where, params = _scope(user)
    if event_type:
        params.append(event_type)
        where = (where + (" and " if where else "where ") + f"event_type = ${len(params)}")
    params += [limit, offset]
    rows = await pool.fetch(
        f"select * from public.audit_events {where} order by seq desc limit ${len(params)-1} offset ${len(params)}",
        *params)
    return {"items": [{k: (v.isoformat() if hasattr(v, "isoformat") else v)
                       for k, v in dict(r).items() if k != "id"} for r in rows]}


@router.get("/audit/export.csv")
async def export_csv(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    where, params = _scope(user)
    rows = await pool.fetch(f"select * from public.audit_events {where} order by seq", *params)
    buf = io.StringIO()
    cols = ["seq", "created_at", "department", "employee_pseudonym", "tool_domain", "direction",
            "event_type", "data_category", "matrix_action", "pattern_types", "masked_excerpt",
            "degraded", "prev_hash", "row_hash"]
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        w.writerow([r[c].isoformat() if c == "created_at" else
                    (",".join(r[c]) if c == "pattern_types" else r[c]) for c in cols])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=shieldgate-audit.csv"})


@router.get("/audit/verify")
async def verify(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    async with pool.acquire() as conn:
        ok, bad = await verify_chain(conn)
    return {"ok": ok, "first_bad_seq": bad}
