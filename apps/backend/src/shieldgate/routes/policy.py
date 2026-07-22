from datetime import UTC, datetime

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from shieldgate.auth import require_employee
from shieldgate.db import get_pool
from shieldgate.generated.models import PolicySnapshot
from shieldgate.policy.engine import current_policy_version

router = APIRouter(tags=["policy"], dependencies=[Depends(require_employee)])


@router.get("/policy/snapshot", response_model=None)
async def snapshot(request: Request, response: Response,
                   pool: asyncpg.Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        version = await current_policy_version(conn)
        etag = f'W/"v{version}"'
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304)
        matrix = await conn.fetch(
            "select data_category, tier, action from public.policy_matrix order by data_category, tier")
        tools = await conn.fetch(
            "select id, name, domains, tier, capability_tags, continuity_status, fallback_tool_id "
            "from public.tools order by name")
    body = PolicySnapshot.model_validate({
        "version": version, "generated_at": datetime.now(UTC).isoformat(),
        "matrix": [dict(m) for m in matrix],
        "tools": [{**dict(t), "id": str(t["id"]),
                   "fallback_tool_id": str(t["fallback_tool_id"]) if t["fallback_tool_id"] else None}
                  for t in tools],
    })
    response.headers["ETag"] = etag
    return body
