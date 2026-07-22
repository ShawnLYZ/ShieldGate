from typing import Literal
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from shieldgate.audit.chain import append_event
from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_role, require_user
from shieldgate.policy.engine import bump_policy_version

router = APIRouter(tags=["registry"])


class NewTool(BaseModel):
    name: str
    vendor: str
    domains: list[str]
    tier: Literal[0, 1, 2]
    capability_tags: list[str] = []
    dpa_status: str = "none"


class ToolPatch(BaseModel):
    tier: Literal[0, 1, 2] | None = None
    capability_tags: list[str] | None = None
    dpa_status: str | None = None
    fallback_tool_id: UUID | None = None


class MatrixCell(BaseModel):
    data_category: Literal["public", "internal", "confidential", "restricted"]
    # out-of-range tiers previously reached the DB CHECK constraint and 500ed
    tier: Literal[0, 1, 2]
    action: Literal["allow", "warn", "block"]


class MatrixEdit(BaseModel):
    cells: list[MatrixCell]


class Continuity(BaseModel):
    status: str
    note: str | None = None


class SettingPatch(BaseModel):
    value: dict


@router.post("/tools")
async def create_tool(body: NewTool, user: AuthUser = Depends(require_user),
                      pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """insert into public.tools (name, vendor, domains, tier, capability_tags, dpa_status)
                   values ($1,$2,$3,$4,$5,$6) returning id""",
                body.name, body.vendor, body.domains, body.tier, body.capability_tags, body.dpa_status)
            await bump_policy_version(conn, f"registered {body.name}")
            await append_event(conn, employee_pseudonym=None, department=None, tool_id=row["id"],
                               tool_domain=None, direction="system", event_type="tool_change",
                               masked_excerpt=f"created {body.name} tier {body.tier}")
    return {"id": str(row["id"])}


@router.patch("/tools/{tool_id}")
async def patch_tool(tool_id: UUID, body: ToolPatch, user: AuthUser = Depends(require_user),
                     pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    fields, values = [], []
    for i, (k, v) in enumerate([(k, v) for k, v in body.model_dump(exclude_none=True).items()], start=2):
        fields.append(f"{k}=${i}")
        values.append(v)
    if not fields:
        raise HTTPException(400, {"code": "no_fields", "message": "Nothing to update."})
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                f"update public.tools set {', '.join(fields)}, updated_at=now() where id=$1", tool_id, *values)
            await bump_policy_version(conn, f"edited tool {tool_id}")
            await append_event(conn, employee_pseudonym=None, department=None, tool_id=tool_id,
                               tool_domain=None, direction="system", event_type="tool_change",
                               masked_excerpt="tool edited")
    return {"ok": True}


@router.patch("/policy-matrix")
async def edit_matrix(body: MatrixEdit, user: AuthUser = Depends(require_user),
                      pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    async with pool.acquire() as conn:
        async with conn.transaction():
            for c in body.cells:
                await conn.execute(
                    """insert into public.policy_matrix (data_category, tier, action)
                       values ($1,$2,$3)
                       on conflict (data_category, tier) do update set action=excluded.action, updated_at=now()""",
                    c.data_category, c.tier, c.action)
            await bump_policy_version(conn, "matrix edited")
            await append_event(conn, employee_pseudonym=None, department=None, tool_id=None,
                               tool_domain=None, direction="system", event_type="policy_change",
                               masked_excerpt=f"{len(body.cells)} cell(s) edited")
    return {"ok": True}


@router.post("/tools/{tool_id}/continuity")
async def continuity(tool_id: UUID, body: Continuity, user: AuthUser = Depends(require_user),
                     pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    if body.status not in ("active", "advisory", "suspended"):
        raise HTTPException(400, {"code": "bad_status", "message": "Invalid continuity status."})
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "update public.tools set continuity_status=$2, continuity_note=$3, updated_at=now() where id=$1",
                tool_id, body.status, body.note)
            await bump_policy_version(conn, f"continuity {body.status} for {tool_id}")
            await append_event(conn, employee_pseudonym=None, department=None, tool_id=tool_id,
                               tool_domain=None, direction="system", event_type="continuity_change",
                               masked_excerpt=f"{body.status}: {body.note or ''}"[:160])
    return {"ok": True}


@router.get("/settings/{key}")
async def get_setting(key: str, user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    # No GET counterpart existed for the Task 11a PATCH endpoint; the dashboard
    # settings editor needs to show the current value before an admin edits it,
    # so this mirrors patch_setting's admin gate read-only.
    value = await pool.fetchval("select value from public.app_settings where key=$1", key)
    if value is None:
        raise HTTPException(404, {"code": "not_found", "message": "No such setting."})
    return {"key": key, "value": value}


@router.patch("/settings/{key}")
async def patch_setting(key: str, body: SettingPatch, user: AuthUser = Depends(require_user),
                        pool: asyncpg.Pool = Depends(get_pool)):
    require_role(user, "admin")
    # Tunables (cost_model, risk_weights, ...) are not policy: no version bump,
    # no audit event — matches the plan's split between policy and settings edits.
    await pool.execute(
        """insert into public.app_settings (key, value) values ($1,$2)
           on conflict (key) do update set value=excluded.value, updated_at=now()""",
        key, body.value)
    return {"ok": True, "key": key}
