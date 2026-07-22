from datetime import datetime, timedelta, timezone

from shieldgate.approvals.engine import create_request
from shieldgate.scheduler import sweep_sla


def clock():
    return datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)


async def test_sweep_flips_to_breached_and_logs_once(db):
    r = await create_request(db, tool_name="X", tool_url="https://x.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering", purpose="p", clock=clock)
    future = r["sla_due_at"] + timedelta(days=1)
    await sweep_sla(db, future)
    row = await db.fetchrow("select sla_state from public.approval_requests where id=$1", r["id"])
    assert row["sla_state"] == "breached"
    n1 = await db.fetchval("select count(*) from public.audit_events where event_type='sla_reminder'")
    await sweep_sla(db, future)  # idempotent — no duplicate reminder
    n2 = await db.fetchval("select count(*) from public.audit_events where event_type='sla_reminder'")
    assert n1 == n2 == 1
