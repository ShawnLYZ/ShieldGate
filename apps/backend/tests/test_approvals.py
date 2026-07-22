from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from shieldgate.approvals.engine import (
    add_business_days,
    create_request,
    decide,
    evaluate_sla,
    provide_info,
)
from shieldgate.jwt_auth import AuthUser

MGR = AuthUser(id="00000000-0000-0000-0000-0000000000a2", role="manager", department="Engineering")
ADM = AuthUser(id="00000000-0000-0000-0000-0000000000a1", role="admin", department="Engineering")

FIXED = datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)  # a Thursday


def clock():
    return FIXED


def test_business_days_skips_weekend():
    # Thu + 3 business days = Tue
    assert add_business_days(FIXED, 3).date().isoformat() == "2026-07-21"


def test_sla_states():
    assert evaluate_sla(add_business_days(FIXED, 3), FIXED) == "on_track"
    assert evaluate_sla(add_business_days(FIXED, 1), add_business_days(FIXED, 1)) in ("at_risk", "breached")


def test_sla_at_risk_counts_business_days_not_calendar():
    # Evaluated on a Friday with a due date the following Monday: only one business
    # day remains (the weekend is skipped), so this is at_risk — not on_track as a
    # calendar-day (~3 days) reading would say.
    friday = datetime(2026, 7, 17, 12, 0, tzinfo=timezone.utc)   # Fri
    monday = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)   # Mon
    assert monday.weekday() == 0 and friday.weekday() == 4
    assert evaluate_sla(monday, friday) == "at_risk"


async def test_create_scores_and_sets_sla(db):
    r = await create_request(db, tool_name="Claude", tool_url="https://claude.ai",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="analysis", clock=clock)
    assert r["status"] == "triaged"
    assert r["risk_score"] >= 70 and r["recommended_tier"] == 2
    assert r["sla_due_at"].date().isoformat() == "2026-07-21"


async def test_two_reviewer_approval_upserts_tool_and_bumps_version(db):
    from shieldgate.jwt_auth import AuthUser
    from shieldgate.policy.engine import current_policy_version, resolve_tool
    before = await current_policy_version(db)
    r = await create_request(db, tool_name="NoteGenius", tool_url="https://notegenius.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="meeting notes", clock=clock)
    mgr = AuthUser(id="00000000-0000-0000-0000-0000000000a2", role="manager", department="Engineering")
    adm = AuthUser(id="00000000-0000-0000-0000-0000000000a1", role="admin", department="Engineering")
    await decide(db, r["id"], mgr, "approve", tier=1, note=None, clock=clock)
    out = await decide(db, r["id"], adm, "approve", tier=1, note=None, clock=clock)
    assert out["status"] == "approved" and out["assigned_tier"] == 1
    assert await current_policy_version(db) == before + 1
    tool = await resolve_tool(db, "notegenius.example")
    assert tool.tier == 1


async def test_reject_terminal(db):
    from shieldgate.jwt_auth import AuthUser
    r = await create_request(db, tool_name="Sketchy", tool_url="https://sketchy.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="x", clock=clock)
    adm = AuthUser(id="00000000-0000-0000-0000-0000000000a1", role="admin", department="Engineering")
    out = await decide(db, r["id"], adm, "reject", tier=None, note="no DPA", clock=clock)
    assert out["status"] == "rejected"


async def test_info_request_loop(db):
    # Manager asks for more info -> info_requested; employee replies -> under_review.
    r = await create_request(db, tool_name="InfoLoop", tool_url="https://infoloop.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="need this tool for analysis", clock=clock)
    out = await decide(db, r["id"], MGR, "info", tier=None, note="please clarify scope", clock=clock)
    assert out["status"] == "info_requested"
    back = await provide_info(db, r["id"], "EMP-D3A1", "here is the scope detail")
    assert back["status"] == "under_review"


async def test_rejection_writes_an_audit_event(db):
    # Approvals write an approval_decision audit event; rejections were silent, so a
    # rejected request left no monitoring trail. Assert a rejection is audited too.
    r = await create_request(db, tool_name="RejectMe", tool_url="https://rejectme.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="x", clock=clock)
    out = await decide(db, r["id"], ADM, "reject", tier=None, note="no DPA", clock=clock)
    assert out["status"] == "rejected"
    ev = await db.fetchrow(
        "select * from public.audit_events where event_type='approval_decision' "
        "and masked_excerpt like '%rejected%' order by seq desc limit 1")
    assert ev is not None


async def test_auto_rejected_is_terminal_and_non_overridable(db):
    # A prohibited-use request auto-rejects; §7 / PRD story 25 say that is terminal
    # and non-overridable. A reviewer must not be able to flip it to approved
    # (which would register the tool in the policy registry).
    r = await create_request(db, tool_name="SpyTool", tool_url="https://spytool.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering",
                             purpose="covertly monitor employee keystrokes", clock=clock)
    assert r["status"] == "auto_rejected"
    try:
        with pytest.raises(HTTPException) as ei:
            await decide(db, r["id"], MGR, "approve", tier=2, note=None, clock=clock)
        assert ei.value.status_code == 409
        row = await db.fetchrow("select status from public.approval_requests where id=$1", r["id"])
        assert row["status"] == "auto_rejected"
        assert await db.fetchval(
            "select count(*) from public.tools where name='SpyTool'") == 0
    finally:
        # SpyTool must never land in the un-truncated seed `tools` table, even if the
        # guard regresses and the override succeeds during a RED run.
        await db.execute("delete from public.tools where name='SpyTool'")


async def test_auto_rejected_cannot_be_reopened_via_info(db):
    r = await create_request(db, tool_name="SpyTool2", tool_url="https://spytool2.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering",
                             purpose="secretly surveil staff without their consent", clock=clock)
    assert r["status"] == "auto_rejected"
    with pytest.raises(HTTPException) as ei:
        await decide(db, r["id"], MGR, "info", tier=None, note="clarify", clock=clock)
    assert ei.value.status_code == 409
    row = await db.fetchrow("select status from public.approval_requests where id=$1", r["id"])
    assert row["status"] == "auto_rejected"


async def test_rejected_request_rejects_a_second_decision(db):
    r = await create_request(db, tool_name="Sketchy2", tool_url="https://sketchy2.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="x", clock=clock)
    out = await decide(db, r["id"], ADM, "reject", tier=None, note="no DPA", clock=clock)
    assert out["status"] == "rejected"
    try:
        with pytest.raises(HTTPException) as ei:
            await decide(db, r["id"], MGR, "approve", tier=1, note=None, clock=clock)
        assert ei.value.status_code == 409
        assert await db.fetchval(
            "select count(*) from public.tools where name='Sketchy2'") == 0
    finally:
        await db.execute("delete from public.tools where name='Sketchy2'")


async def test_provide_info_refused_on_terminal_request(db):
    r = await create_request(db, tool_name="SpyTool3", tool_url="https://spytool3.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering",
                             purpose="covertly monitor keystrokes of staff", clock=clock)
    assert r["status"] == "auto_rejected"
    with pytest.raises(HTTPException) as ei:
        await provide_info(db, r["id"], "EMP-D3A1", "here is more context")
    assert ei.value.status_code == 409
