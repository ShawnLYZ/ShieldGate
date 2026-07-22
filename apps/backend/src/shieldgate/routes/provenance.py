from datetime import UTC, datetime

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from shieldgate.auth import Employee, require_employee
from shieldgate.db import get_pool
from shieldgate.policy.engine import resolve_tool
from shieldgate.provenance import content_hash, strip_footer
from shieldgate.refs import next_ref

router = APIRouter(tags=["provenance"])


class RegisterProv(BaseModel):
    text: str
    tool_domain: str


class VerifyText(BaseModel):
    text: str


@router.post("/provenance")
async def register(body: RegisterProv, employee: Employee = Depends(require_employee),
                   pool: asyncpg.Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        tool = await resolve_tool(conn, body.tool_domain)
        async with conn.transaction():
            ref = await next_ref(conn, "PV", "provenance_records")
            await conn.execute(
                """insert into public.provenance_records
                   (public_ref, content_hash, tool_id, tool_label, employee_pseudonym)
                   values ($1,$2,$3,$4,$5)""",
                ref, content_hash(body.text), tool.id, tool.name, employee.pseudonym)
    stamp = datetime.now(UTC).isoformat()
    footer = f"\n\n—\nAI-assisted · {tool.name} · {stamp} · {ref}"
    return {"public_ref": ref, "footer": footer}


@router.get("/provenance/verify")
async def verify_by_id(id: str, pool: asyncpg.Pool = Depends(get_pool)):
    row = await pool.fetchrow(
        "select public_ref, tool_label, created_at from public.provenance_records where public_ref=$1", id)
    if row is None:
        return {"match": False}
    return {"match": True, "public_ref": row["public_ref"], "tool_label": row["tool_label"],
            "created_at": row["created_at"].isoformat()}


@router.post("/provenance/verify")
async def verify_by_text(body: VerifyText, pool: asyncpg.Pool = Depends(get_pool)):
    for candidate in (body.text, strip_footer(body.text)):
        row = await pool.fetchrow(
            "select public_ref, tool_label, created_at from public.provenance_records "
            "where content_hash=$1", content_hash(candidate))
        if row:
            return {"match": True, "public_ref": row["public_ref"], "tool_label": row["tool_label"],
                    "created_at": row["created_at"].isoformat()}
    return {"match": False}
