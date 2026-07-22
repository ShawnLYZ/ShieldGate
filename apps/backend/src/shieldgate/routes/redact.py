import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from shieldgate.audit.chain import append_event
from shieldgate.auth import Employee, require_employee
from shieldgate.classify.patterns import mask_text, scan
from shieldgate.db import get_pool
from shieldgate.generated.models import ClassifyResponse
from shieldgate.policy.engine import (
    current_policy_version,
    effective_tier,
    load_matrix,
    matrix_action,
    resolve_category,
    resolve_tool,
)

router = APIRouter(tags=["redact"])


class RedactConfirm(BaseModel):
    text: str
    tool_domain: str


@router.post("/redact/confirm")
async def redact_confirm(body: RedactConfirm, employee: Employee = Depends(require_employee),
                         pool: asyncpg.Pool = Depends(get_pool)) -> ClassifyResponse:
    async with pool.acquire() as conn:
        matches = scan(body.text)  # scan the residual the user is about to send
        category = resolve_category(matches)
        tool = await resolve_tool(conn, body.tool_domain)
        matrix = await load_matrix(conn)
        action = matrix_action(matrix, category, effective_tier(tool))
        version = await current_policy_version(conn)
        # mask_text over zero matches returns the text unchanged — a clean residual would
        # otherwise persist raw prompt chars, violating the "never store raw bodies" invariant.
        # Use a category placeholder when there is nothing to mask.
        excerpt = mask_text(body.text, matches)[:160] if matches else f"[redacted send: {category}]"
        await append_event(conn, employee_pseudonym=employee.pseudonym, department=employee.department,
                           tool_id=tool.id, tool_domain=body.tool_domain, direction="prompt",
                           event_type="redacted_send", data_category=category, matrix_action=action,
                           pattern_types=[m.type for m in matches],
                           masked_excerpt=excerpt)
        return ClassifyResponse.model_validate({
            "category": category, "action": action,
            "matches": [{"type": m.type, "span": [m.start, m.end], "masked": m.masked} for m in matches],
            "maskable": bool(matches),
            "reason_plain": ("Redacted version is clean — safe to send." if action == "allow"
                             else "Redacted version still contains sensitive data."),
            "coaching": {"show": False}, "suggestion": None,
            "policy_version": version, "degraded": False,
        })
