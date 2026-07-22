import asyncpg
from fastapi import APIRouter, Depends

from shieldgate.audit.chain import append_event
from shieldgate.auth import Employee, require_employee
from shieldgate.db import get_pool
from shieldgate.generated.models import EventBatch

router = APIRouter(tags=["events"])


@router.post("/events")
async def ingest(batch: EventBatch, employee: Employee = Depends(require_employee),
                 pool: asyncpg.Pool = Depends(get_pool)) -> dict[str, int]:
    async with pool.acquire() as conn:
        for e in batch.events:
            await append_event(
                conn, employee_pseudonym=employee.pseudonym, department=employee.department,
                tool_id=None, tool_domain=e.tool_domain, direction=e.direction,
                event_type=e.event_type, data_category=e.data_category,
                matrix_action=e.matrix_action, pattern_types=e.pattern_types or [],
                masked_excerpt=e.masked_excerpt, degraded=bool(e.degraded),
                occurred_at=e.occurred_at,
            )
    return {"accepted": len(batch.events)}
