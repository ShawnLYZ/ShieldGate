from datetime import UTC, datetime

from shieldgate.audit.chain import verify_chain
from shieldgate.demo_seed import seed_demo_events

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


async def test_seeds_spread_of_events_and_chain_verifies(db):
    # Spec §2 seeds: "a spread of historical audit events so every panel renders
    # populated" — appended through the hash chain, never raw SQL.
    n = await seed_demo_events(db, now=NOW)
    assert n >= 30
    assert await db.fetchval("select count(*) from public.audit_events") == n
    ok, bad = await verify_chain(db)
    assert ok and bad is None

    depts = {r["d"] for r in await db.fetch(
        "select distinct department as d from public.audit_events where department is not null")}
    assert {"Engineering", "Finance", "HR", "Marketing"} <= depts

    kinds = {r["t"] for r in await db.fetch(
        "select distinct event_type as t from public.audit_events")}
    assert {"block", "warn", "allow_usage", "redacted_send", "output_flag"} <= kinds

    # enough distinct days for the incidents trend to draw a line
    days = await db.fetchval("select count(distinct created_at::date) from public.audit_events")
    assert days >= 7

    # output_flag rows populate /output-risk; every tool resolves to a registry id
    assert await db.fetchval(
        "select count(*) from public.audit_events where event_type='output_flag'") >= 3
    assert await db.fetchval(
        "select count(*) from public.audit_events where tool_id is null") == 0


async def test_never_persists_raw_sensitive_content(db):
    await seed_demo_events(db, now=NOW)
    hits = await db.fetchval(
        "select count(*) from public.audit_events "
        "where masked_excerpt ~ '\\d{4}-\\d{4}-\\d{4}-\\d{4}' "
        "   or masked_excerpt ~ '\\d{6}-\\d{2}-\\d{4}'")
    assert hits == 0


async def test_noop_when_audit_events_already_exist(db):
    n1 = await seed_demo_events(db, now=NOW)
    n2 = await seed_demo_events(db, now=NOW)
    assert n1 > 0
    assert n2 == 0
