import csv
import io
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from shieldgate.approvals.engine import create_request, decide, provide_info
from shieldgate.auth import require_employee
from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_role, require_user

router = APIRouter(tags=["approvals"])


def clock() -> datetime:
    return datetime.now(UTC)


# Reviewer ids alone are not an auditor surface (story 53) — join display names.
# The backend joins profiles here because dashboard clients cannot: RLS lets a
# manager read only their own profile row.
_JOINED = """select r.*, mp.display_name as manager_reviewer_name,
                    ap.display_name as admin_reviewer_name
             from public.approval_requests r
             left join public.profiles mp on mp.id = r.manager_reviewer
             left join public.profiles ap on ap.id = r.admin_reviewer"""


class NewRequest(BaseModel):
    tool_name: str
    tool_url: str | None = None
    purpose: str


class Decision(BaseModel):
    decision: Literal["approve", "reject", "info"]
    tier: Literal[0, 1, 2] | None = None
    note: str | None = None


@router.post("/approvals")
async def submit(body: NewRequest, request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    # Accept either an employee token or a JWT.
    token = request.headers.get("X-ShieldGate-Token")
    async with pool.acquire() as conn:
        if token:
            emp = await pool.fetchrow(
                "select pseudonym, department, profile_id from public.employee_tokens where token=$1 and active", token)
            if emp is None:
                raise HTTPException(401, {"code": "invalid_token", "message": "Unknown token."})
            r = await create_request(conn, tool_name=body.tool_name, tool_url=body.tool_url,
                requester_profile=emp["profile_id"], requester_pseudonym=emp["pseudonym"],
                department=emp["department"], purpose=body.purpose, clock=clock)
        else:
            user = await require_user(request, pool)
            r = await create_request(conn, tool_name=body.tool_name, tool_url=body.tool_url,
                requester_profile=user.id, requester_pseudonym=None,
                department=user.department, purpose=body.purpose, clock=clock)
    return _view(r)


@router.get("/approvals")
async def list_requests(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    # Story 9: employees authenticate with a token (not a JWT) and see only their own
    # requests. Managers/admins authenticate via JWT and see their department / all.
    token = request.headers.get("X-ShieldGate-Token")
    if token:
        emp = await pool.fetchrow(
            "select pseudonym from public.employee_tokens where token=$1 and active", token)
        if emp is None:
            raise HTTPException(401, {"code": "invalid_token", "message": "Unknown token."})
        rows = await pool.fetch(
            "select * from public.approval_requests where requested_by_pseudonym=$1 order by created_at desc",
            emp["pseudonym"])
        return [_view(dict(r)) for r in rows]
    user = await require_user(request, pool)
    if user.role == "admin":
        rows = await pool.fetch(f"{_JOINED} order by r.created_at desc")
    elif user.role == "manager":
        rows = await pool.fetch(
            f"{_JOINED} where r.department=$1 order by r.created_at desc", user.department)
    else:
        rows = await pool.fetch(
            f"{_JOINED} where r.requested_by_profile=$1 order by r.created_at desc", user.id)
    return [_view(dict(r)) for r in rows]


@router.get("/approvals/export.csv")
async def export_csv(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    # Story 51: timestamped, scoped CSV export of approval decisions for auditors.
    # Same scoping as the queue: admin exports all, manager own department.
    user = await require_user(request, pool)
    require_role(user, "manager", "admin")
    if user.role == "admin":
        rows = await pool.fetch(f"{_JOINED} order by r.created_at")
    else:
        rows = await pool.fetch(f"{_JOINED} where r.department=$1 order by r.created_at",
                                user.department)
    cols = ["created_at", "tool_name", "department", "requested_by_pseudonym", "status",
            "risk_score", "recommended_tier", "assigned_tier",
            "manager_decision", "manager_reviewer_name", "manager_decided_at",
            "admin_decision", "admin_reviewer_name", "admin_decided_at",
            "sla_due_at", "sla_state", "purpose"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        w.writerow([v.isoformat() if hasattr(v, "isoformat") else v for v in (r[c] for c in cols)])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=shieldgate-approvals.csv"})


@router.post("/approvals/{request_id}/decision")
async def decide_route(request_id: UUID, body: Decision, request: Request,
                       user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "manager", "admin")
    async with pool.acquire() as conn:
        out = await decide(conn, request_id, user, body.decision, body.tier, body.note, clock)
    return _view(out)


@router.post("/approvals/{request_id}/info")
async def info_route(request: Request, request_id: UUID, note: str = Body(..., embed=True),
                     pool: asyncpg.Pool = Depends(get_pool)):
    emp = await require_employee(request, pool)
    async with pool.acquire() as conn:
        out = await provide_info(conn, request_id, emp.pseudonym, note)
    return _view(out)


def _view(r: dict) -> dict:
    return {k: (v.isoformat() if hasattr(v, "isoformat") else str(v) if k == "id" else v)
            for k, v in r.items()}
