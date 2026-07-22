import logging

import asyncpg
from fastapi import APIRouter, Depends, Request

from shieldgate.audit.chain import append_event
from shieldgate.auth import Employee, require_employee
from shieldgate.classify.output import scan_output
from shieldgate.classify.patterns import mask_text, scan
from shieldgate.classify.providers import get_classifier
from shieldgate.db import get_pool
from shieldgate.generated.models import ClassifyRequest, ClassifyResponse
from shieldgate.policy.engine import (
    SEVERITY,
    current_policy_version,
    effective_tier,
    load_matrix,
    matrix_action,
    resolve_category,
    resolve_tool,
)
from shieldgate.policy.suggest import suggest_tool

router = APIRouter(tags=["classify"])
logger = logging.getLogger(__name__)

REASONS = {
    "card": "a payment card number", "my_ic": "a Malaysian IC number",
    "passport": "a passport number", "api_key": "an API key or credential",
    "email": "an email address", "phone": "a phone number",
}
EXCERPT_LEN = 160


def is_document_shaped(text: str) -> bool:
    """Heuristic for ambiguous long-form/structured content worth escalating to the
    context classifier (story 12). Kept in sync with the extension's doc-shape.ts.
    """
    return len(text) >= 200 or text.count("\n") >= 3


def build_reason(pattern_types: list[str], llm_reason: str | None,
                 action: str, tool_name: str, tier: int, category: str) -> str:
    if pattern_types:
        things = sorted({REASONS[t] for t in pattern_types if t in REASONS})
        what = ", ".join(things)
        detail = f"This prompt contains {what} — Restricted data."
    elif llm_reason:
        # Context findings can be internal/confidential/restricted — name the
        # category the classifier actually returned (story 2: teach the real rule).
        detail = f"This content looks {category.capitalize()}: {llm_reason}."
    else:
        return "Allowed by the Policy Matrix."
    rule = {
        "block": f"{tool_name} is a Tier {tier} tool, and the Policy Matrix blocks this data category there.",
        "warn": f"{tool_name} is a Tier {tier} tool — sharing this data category there is discouraged and logged.",
        "allow": "",
    }[action]
    return f"{detail} {rule}".strip()


@router.post("/classify")
async def classify(
    body: ClassifyRequest, request: Request,
    employee: Employee = Depends(require_employee),
    pool: asyncpg.Pool = Depends(get_pool),
) -> ClassifyResponse:
    settings = request.app.state.settings
    async with pool.acquire() as conn:
        if body.direction == "response":
            flags = scan_output(body.text)
            action = "warn" if flags else "allow"
            version = await current_policy_version(conn)
            if flags:
                tool = await resolve_tool(conn, body.tool_domain)
                excerpt = " | ".join(f.masked for f in flags)[:EXCERPT_LEN]
                await append_event(
                    conn, employee_pseudonym=employee.pseudonym, department=employee.department,
                    tool_id=tool.id, tool_domain=body.tool_domain, direction=body.direction,
                    event_type="output_flag", pattern_types=[f.type for f in flags],
                    masked_excerpt=excerpt,
                )
            return ClassifyResponse.model_validate({
                "category": "public", "action": action,
                "matches": [{"type": f.type, "span": [0, 0], "masked": f.masked} for f in flags],
                "maskable": False,
                "reason_plain": (
                    "This response contains " + ", ".join(f.label for f in flags) + "."
                    if flags else "Allowed by the Policy Matrix."
                ),
                "coaching": {"show": False},
                "suggestion": None,
                "policy_version": version, "degraded": False,
            })

        matches = scan(body.text)
        llm = None
        degraded = False
        unrecognized: str | None = None
        saw_unrecognized = False
        if not matches and (is_document_shaped(body.text) or "[[" in body.text):
            try:
                llm = await get_classifier(
                    settings, request.app.state.classifier_reachable
                ).classify_prompt(body.text)
            except Exception:
                degraded = True
            if llm and llm[0] not in SEVERITY:
                unrecognized = llm[0]
                saw_unrecognized = True
                logger.warning("Unrecognized data category from classifier: %r", unrecognized)
                degraded = True
                llm = None
        category = resolve_category(matches, llm[0] if llm else None)
        tool = await resolve_tool(conn, body.tool_domain)
        matrix = await load_matrix(conn)
        action = matrix_action(matrix, category, effective_tier(tool))
        version = await current_policy_version(conn)

        if saw_unrecognized:
            # The resolved action is often "allow" (an unrecognized category can't beat
            # "public" in resolve_category), so the block/warn-gated append_event below
            # would never fire for this case — write unconditionally so a malfunctioning
            # classifier always leaves a trace (story 12).
            # Gate on `saw_unrecognized`, not `unrecognized is not None` — a malformed
            # classifier could legitimately return a category label of None itself, which
            # would collide with the "nothing flagged" sentinel. Build the excerpt via
            # repr() so a None (or any other unexpected type) label never raises.
            await append_event(
                conn, employee_pseudonym=employee.pseudonym, department=employee.department,
                tool_id=tool.id, tool_domain=body.tool_domain, direction=body.direction,
                event_type="unrecognized_category", degraded=True,
                masked_excerpt=f"unrecognized category: {repr(unrecognized)[:60]}",
            )

        suggestion = None
        if action in ("block", "warn"):
            # Suggest a same-capability alternative — a block on an image/code tool should
            # not steer the user to a chat tool. Fall back to "chat" only when unknown.
            needed_capability = tool.capability_tags[0] if tool.capability_tags else "chat"
            suggestion = await suggest_tool(conn, needed_capability,
                                            exclude_tool_id=tool.id,
                                            fallback_tool_id=tool.fallback_tool_id)

        coaching_show = False
        if action in ("block", "warn"):
            if action == "block":
                inserted = await conn.fetchrow(
                    "insert into public.coaching_state (pseudonym) values ($1) "
                    "on conflict do nothing returning pseudonym", employee.pseudonym,
                )
                coaching_show = inserted is not None
                if coaching_show:
                    # §2 event list: coaching_shown, appended at the moment the
                    # once-per-pseudonym state flips (server-side, so the audit
                    # trail exists even if the tab never renders the card).
                    await append_event(
                        conn, employee_pseudonym=employee.pseudonym,
                        department=employee.department, tool_id=tool.id,
                        tool_domain=body.tool_domain, direction="system",
                        event_type="coaching_shown",
                    )
            if matches:
                excerpt = mask_text(body.text, matches)[:EXCERPT_LEN]
            else:
                # Context-only (LLM) finding: no span-localized match to mask, so the
                # audit excerpt must never contain raw prompt text. Category-only placeholder.
                excerpt = f"[context finding: {category}]"
            await append_event(
                conn, employee_pseudonym=employee.pseudonym, department=employee.department,
                tool_id=tool.id, tool_domain=body.tool_domain, direction=body.direction,
                event_type=action, data_category=category, matrix_action=action,
                pattern_types=[m.type for m in matches], masked_excerpt=excerpt,
                degraded=degraded,
            )

        return ClassifyResponse.model_validate({
            "category": category, "action": action,
            "matches": [{"type": m.type, "span": [m.start, m.end], "masked": m.masked}
                        for m in matches],
            "maskable": bool(matches),
            "reason_plain": build_reason([m.type for m in matches],
                                         llm[1] if llm else None, action, tool.name, tool.tier,
                                         category),
            "coaching": {"show": coaching_show},
            "suggestion": suggestion,
            "policy_version": version, "degraded": degraded,
        })
