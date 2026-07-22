from datetime import datetime, timedelta
from typing import Callable

from fastapi import HTTPException

from shieldgate.audit.chain import append_event
from shieldgate.generated.models import ApprovalStatus
from shieldgate.policy.engine import bump_policy_version

from .prohibited import prohibited_check
from .scoring import score_vendor

# Terminal states are final and non-overridable (design §7, PRD story 25).
# auto_rejected is the prohibited-use ethical floor — no reviewer may flip it.
# Statuses come from the shared policy package (design §4): StrEnum members
# compare/hash as their string values, so `status in TERMINAL_STATUSES` keeps
# working for the raw strings asyncpg returns.
TERMINAL_STATUSES = frozenset({
    ApprovalStatus.approved, ApprovalStatus.rejected, ApprovalStatus.auto_rejected,
})


async def _reject_if_terminal(conn, request_id) -> None:
    status = await conn.fetchval(
        "select status from public.approval_requests where id=$1", request_id)
    if status is None:
        raise HTTPException(404, {"code": "not_found", "message": "No such request."})
    if status in TERMINAL_STATUSES:
        raise HTTPException(409, {
            "code": "terminal_state",
            "message": f"This request is {status}; the decision is final and cannot be changed.",
        })


def add_business_days(dt: datetime, n: int) -> datetime:
    cur = dt
    added = 0
    while added < n:
        cur = cur + timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


def business_days_between(start: datetime, end: datetime) -> int:
    """Whole business days from start to end (0 if end <= start). Weekends don't count."""
    if end <= start:
        return 0
    days = 0
    cur = start
    while cur + timedelta(days=1) <= end:
        cur = cur + timedelta(days=1)
        if cur.weekday() < 5:
            days += 1
    return days


def evaluate_sla(due: datetime, now: datetime) -> str:
    if due <= now:
        return "breached"
    # at_risk is measured in business days, not calendar days: a Friday->Monday gap is a
    # single business day even though it spans ~3 calendar days.
    if business_days_between(now, due) <= 1:
        return "at_risk"
    return "on_track"


async def create_request(conn, *, tool_name, tool_url, requester_profile, requester_pseudonym,
                         department, purpose, clock: Callable[[], datetime]) -> dict:
    now = clock()
    reason = prohibited_check(tool_name, purpose)
    if reason:
        row = await conn.fetchrow(
            """insert into public.approval_requests
               (tool_name, tool_url, requested_by_profile, requested_by_pseudonym, department,
                purpose, status, sla_due_at, info_request_note)
               values ($1,$2,$3,$4,$5,$6,'auto_rejected',$7,$8) returning *""",
            tool_name, tool_url, requester_profile, requester_pseudonym, department, purpose,
            add_business_days(now, 3), f"Auto-rejected: {reason}",
        )
        await append_event(conn, employee_pseudonym=requester_pseudonym, department=department,
                           tool_id=None, tool_domain=tool_url, direction="system",
                           event_type="approval_submitted", masked_excerpt=f"auto-rejected: {reason}")
        return dict(row)

    score = await score_vendor(conn, tool_name, tool_url)
    row = await conn.fetchrow(
        """insert into public.approval_requests
           (tool_name, tool_url, requested_by_profile, requested_by_pseudonym, department, purpose,
            status, risk_score, risk_signals, recommended_tier, sla_due_at, sla_state)
           values ($1,$2,$3,$4,$5,$6,'triaged',$7,$8,$9,$10,'on_track') returning *""",
        tool_name, tool_url, requester_profile, requester_pseudonym, department, purpose,
        score.score, score.signals, score.recommended_tier, add_business_days(now, 3),
    )
    await append_event(conn, employee_pseudonym=requester_pseudonym, department=department,
                       tool_id=None, tool_domain=tool_url, direction="system",
                       event_type="approval_submitted",
                       masked_excerpt=f"{tool_name} scored {score.score}")
    return dict(row)


async def _maybe_finalize(conn, request_id, clock) -> dict:
    r = await conn.fetchrow("select * from public.approval_requests where id=$1", request_id)
    if r["manager_decision"] == "reject" or r["admin_decision"] == "reject":
        out = await conn.fetchrow(
            "update public.approval_requests set status='rejected', updated_at=now() where id=$1 returning *",
            request_id)
        await append_event(conn, employee_pseudonym=r["requested_by_pseudonym"], department=r["department"],
                           tool_id=None, tool_domain=None, direction="system",
                           event_type="approval_decision", masked_excerpt="rejected")
        return dict(out)
    if r["manager_decision"] == "approve" and r["admin_decision"] == "approve":
        tier = r["assigned_tier"] if r["assigned_tier"] is not None else r["recommended_tier"] or 0
        domain = (r["tool_url"] or "").replace("https://", "").replace("http://", "").split("/")[0]
        await conn.execute(
            """insert into public.tools (name, vendor, domains, tier, capability_tags, dpa_status)
               values ($1,$1,$2,$3,'{}','reviewed')
               on conflict (name) do update set tier=excluded.tier, updated_at=now()""",
            r["tool_name"], [domain] if domain else [], tier)
        await bump_policy_version(conn, f"approved {r['tool_name']} at tier {tier}")
        out = await conn.fetchrow(
            "update public.approval_requests set status='approved', assigned_tier=$2, updated_at=now() where id=$1 returning *",
            request_id, tier)
        await append_event(conn, employee_pseudonym=r["requested_by_pseudonym"], department=r["department"],
                           tool_id=None, tool_domain=domain, direction="system",
                           event_type="approval_decision", masked_excerpt=f"approved tier {tier}")
        return dict(out)
    return dict(r)


async def decide(conn, request_id, reviewer, decision: str, tier: int | None,
                 note: str | None, clock) -> dict:
    await _reject_if_terminal(conn, request_id)
    col = "manager" if reviewer.role == "manager" else "admin"
    if decision == "info":
        await conn.execute(
            f"""update public.approval_requests set status='info_requested', info_request_note=$2,
                {col}_decision='info', {col}_reviewer=$3, {col}_decided_at=now(), updated_at=now()
                where id=$1""", request_id, note, reviewer.id)
        return dict(await conn.fetchrow("select * from public.approval_requests where id=$1", request_id))
    await conn.execute(
        f"""update public.approval_requests set {col}_decision=$2, {col}_reviewer=$3,
            {col}_decided_at=now(), assigned_tier=coalesce($4, assigned_tier),
            status='under_review', updated_at=now() where id=$1""",
        request_id, decision, reviewer.id, tier)
    return await _maybe_finalize(conn, request_id, clock)


async def provide_info(conn, request_id, requester_pseudonym, note: str) -> dict:
    await _reject_if_terminal(conn, request_id)
    return dict(await conn.fetchrow(
        """update public.approval_requests set status='under_review',
           info_request_note = coalesce(info_request_note,'') || E'\\nReply: ' || $2, updated_at=now()
           where id=$1 returning *""", request_id, note))
