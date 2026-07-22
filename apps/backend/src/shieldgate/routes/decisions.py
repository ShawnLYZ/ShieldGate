import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_role, require_user
from shieldgate.refs import next_ref

router = APIRouter(tags=["decisions"])


class Register(BaseModel):
    subject_ref: str
    system_name: str
    model_used: str
    explanation_text: str = Field(min_length=20)


class AppealIn(BaseModel):
    reason: str


class Resolve(BaseModel):
    note: str


def _check_internal(request: Request) -> None:
    expected = request.app.state.settings.decision_api_key
    if request.headers.get("X-Internal-Key") != expected:
        raise HTTPException(401, {"code": "bad_internal_key", "message": "Invalid internal key."})


@router.post("/decisions")
async def register(body: Register, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    _check_internal(request)
    async with pool.acquire() as conn:
        async with conn.transaction():
            ref = await next_ref(conn, "DR", "decision_registrations")
            await conn.execute(
                """insert into public.decision_registrations
                   (public_ref, subject_ref, system_name, model_used, explanation_text)
                   values ($1,$2,$3,$4,$5)""",
                ref, body.subject_ref, body.system_name, body.model_used, body.explanation_text)
    return {"public_ref": ref}


@router.get("/decisions/lookup")
async def lookup(ref: str, pool: asyncpg.Pool = Depends(get_pool)):
    row = await pool.fetchrow(
        "select public_ref, system_name, model_used, explanation_text, decided_at "
        "from public.decision_registrations where public_ref=$1", ref)
    if row is None:
        raise HTTPException(404, {"code": "not_found", "message": "No decision with that reference."})
    return {**dict(row), "decided_at": row["decided_at"].isoformat(), "ai_involved": True}


@router.post("/decisions/{ref}/appeals")
async def create_appeal(ref: str, body: AppealIn, pool: asyncpg.Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        decision = await conn.fetchrow(
            "select id from public.decision_registrations where public_ref=$1", ref)
        if decision is None:
            raise HTTPException(404, {"code": "not_found", "message": "No such decision."})
        async with conn.transaction():
            ap_ref = await next_ref(conn, "AP", "appeals")
            await conn.execute(
                "insert into public.appeals (public_ref, decision_id, reason) values ($1,$2,$3)",
                ap_ref, decision["id"], body.reason)
    return {"public_ref": ap_ref}


@router.get("/appeals/{ref}")
async def appeal_status(ref: str, pool: asyncpg.Pool = Depends(get_pool)):
    row = await pool.fetchrow(
        "select public_ref, status, resolution_note, created_at, resolved_at "
        "from public.appeals where public_ref=$1", ref)
    if row is None:
        raise HTTPException(404, {"code": "not_found", "message": "No such appeal."})
    return {"public_ref": row["public_ref"], "status": row["status"],
            "resolution_note": row["resolution_note"],
            "created_at": row["created_at"].isoformat(),
            "resolved_at": row["resolved_at"].isoformat() if row["resolved_at"] else None}


@router.post("/appeals/{appeal_id}/resolve")
async def resolve(appeal_id: str, body: Resolve, request: Request,
                  user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    row = await pool.fetchrow(
        "update public.appeals set status='resolved', resolution_note=$2, resolved_at=now() "
        "where id=$1 returning public_ref", appeal_id, body.note)
    if row is None:
        raise HTTPException(404, {"code": "not_found", "message": "No such appeal."})
    return {"public_ref": row["public_ref"], "status": "resolved"}


@router.get("/decisions")
async def list_decisions(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    rows = await pool.fetch(
        "select public_ref, system_name, model_used, decided_at from public.decision_registrations "
        "order by decided_at desc limit 100")
    return [{"public_ref": r["public_ref"], "system_name": r["system_name"], "model_used": r["model_used"],
             "decided_at": r["decided_at"].isoformat()} for r in rows]


@router.get("/appeals")
async def list_appeals(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    rows = await pool.fetch(
        "select a.id, a.public_ref, d.public_ref as decision_ref, a.reason, a.status, "
        "a.resolution_note, a.created_at, a.resolved_at "
        "from public.appeals a join public.decision_registrations d on d.id = a.decision_id "
        "order by a.created_at desc limit 100")
    return [{"id": str(r["id"]), "public_ref": r["public_ref"], "decision_ref": r["decision_ref"],
             "reason": r["reason"], "status": r["status"], "resolution_note": r["resolution_note"],
             "created_at": r["created_at"].isoformat(),
             "resolved_at": r["resolved_at"].isoformat() if r["resolved_at"] else None} for r in rows]
