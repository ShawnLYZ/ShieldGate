import asyncio
from datetime import UTC, datetime, timedelta

from shieldgate.approvals.engine import evaluate_sla
from shieldgate.audit.chain import append_event
from shieldgate.horizon import refresh_watch
from shieldgate.routes.horizon import _http_get

OPEN = ("submitted", "triaged", "under_review", "info_requested")
HORIZON_INTERVAL = timedelta(hours=1)


async def sweep_sla(conn, now: datetime) -> None:
    rows = await conn.fetch(
        "select * from public.approval_requests where status::text = any($1::text[])", list(OPEN))
    for r in rows:
        new_state = evaluate_sla(r["sla_due_at"], now)
        if new_state != r["sla_state"]:
            await conn.execute(
                "update public.approval_requests set sla_state=$2, updated_at=now() where id=$1",
                r["id"], new_state)
            if new_state in ("at_risk", "breached"):
                await append_event(conn, employee_pseudonym=r["requested_by_pseudonym"],
                                   department=r["department"], tool_id=None, tool_domain=r["tool_url"],
                                   direction="system", event_type="sla_reminder",
                                   masked_excerpt=f"{r['tool_name']} SLA {new_state}")


async def _loop(app):
    # Elapsed-time gate: the app_client test fixture enters this lifespan for
    # every test, so refresh_watch (real HTTP) must never fire on the loop's
    # first iteration or within the first hour of process lifetime -- only
    # after HORIZON_INTERVAL has actually elapsed since the marker below.
    last_horizon = datetime.now(UTC)
    while True:
        try:
            async with app.state.pool.acquire() as conn:
                await sweep_sla(conn, datetime.now(UTC))
        except Exception:
            pass
        now = datetime.now(UTC)
        if now - last_horizon >= HORIZON_INTERVAL:
            try:
                async with app.state.pool.acquire() as conn:
                    await refresh_watch(conn, _http_get)
            except Exception:
                pass
            last_horizon = now
        await asyncio.sleep(60)


def start_scheduler(app) -> None:
    app.state._sla_task = asyncio.create_task(_loop(app))


async def stop_scheduler(app) -> None:
    task = getattr(app.state, "_sla_task", None)
    if task:
        task.cancel()
