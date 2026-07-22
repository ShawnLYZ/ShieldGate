import csv
import io
from datetime import UTC, datetime
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from shieldgate.approvals.engine import create_request
from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_role, require_user
from shieldgate.shadow import KNOWN_AI_DOMAINS, parse_idp_csv

router = APIRouter(tags=["shadow"])


def _clock():
    return datetime.now(UTC)


@router.post("/shadow/import")
async def import_csv(file: UploadFile = File(...), user: AuthUser = Depends(require_user),
                     pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    text = (await file.read()).decode("utf-8")
    async with pool.acquire() as conn:
        known = set()
        for r in await conn.fetch("select unnest(domains) as d from public.tools"):
            known.add(r["d"].lower())
        cands = parse_idp_csv(text, known_domains=known)

        # Compute skipped_known: domains in KNOWN_AI_DOMAINS AND in known
        skipped_domains = set()
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            domain = (row.get("domain") or "").strip().lower()
            if domain in KNOWN_AI_DOMAINS and domain in known:
                skipped_domains.add(domain)

        created = updated = 0
        for c in cands:
            existing = await conn.fetchrow("select id from public.shadow_candidates where domain=$1", c.domain)
            if existing:
                await conn.execute(
                    """update public.shadow_candidates set last_seen=greatest(last_seen,$2),
                       first_seen=least(first_seen,$3), user_count=$4 where domain=$1""",
                    c.domain, c.last_seen, c.first_seen, c.user_count)
                updated += 1
            else:
                await conn.execute(
                    """insert into public.shadow_candidates (domain, source, first_seen, last_seen, user_count)
                       values ($1,'idp_log',$2,$3,$4)""", c.domain, c.first_seen, c.last_seen, c.user_count)
                created += 1
    return {"created": created, "updated": updated, "skipped_known": len(skipped_domains)}


@router.post("/shadow/{candidate_id}/promote")
async def promote(candidate_id: UUID, user: AuthUser = Depends(require_user),
                  pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    async with pool.acquire() as conn:
        cand = await conn.fetchrow("select * from public.shadow_candidates where id=$1", candidate_id)
        if cand is None:
            raise HTTPException(404, {"code": "not_found", "message": "No such candidate."})
        async with conn.transaction():
            req = await create_request(conn, tool_name=cand["domain"], tool_url=f"https://{cand['domain']}",
                                       requester_profile=None, requester_pseudonym=None,
                                       department="Unassigned", purpose="Promoted from shadow discovery",
                                       clock=_clock)
            await conn.execute(
                "update public.shadow_candidates set status='promoted', promoted_request_id=$2 where id=$1",
                candidate_id, req["id"])
    return {"ok": True, "request_id": str(req["id"])}


@router.post("/shadow/{candidate_id}/dismiss")
async def dismiss(candidate_id: UUID, user: AuthUser = Depends(require_user),
                  pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    await pool.execute("update public.shadow_candidates set status='dismissed' where id=$1", candidate_id)
    return {"ok": True}
