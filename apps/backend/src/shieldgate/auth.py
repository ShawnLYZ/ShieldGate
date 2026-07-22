from dataclasses import dataclass

import asyncpg
from fastapi import Depends, HTTPException, Request

from .db import get_pool


@dataclass(frozen=True)
class Employee:
    pseudonym: str
    department: str
    profile_id: object | None


async def require_employee(
    request: Request, pool: asyncpg.Pool = Depends(get_pool)
) -> Employee:
    token = request.headers.get("X-ShieldGate-Token", "")
    row = await pool.fetchrow(
        "select pseudonym, department, profile_id from public.employee_tokens "
        "where token = $1 and active", token,
    )
    if row is None:
        raise HTTPException(401, {"code": "invalid_token", "message": "Unknown or inactive employee token."})
    return Employee(row["pseudonym"], row["department"], row["profile_id"])
