import hashlib
import json
from datetime import UTC, datetime


from shieldgate.db import DbConn

GENESIS_HASH = hashlib.sha256(b"shieldgate-genesis").hexdigest()
_LOCK_KEY = 815001


def canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_row_hash(prev_hash: str, payload: dict) -> str:
    return hashlib.sha256((prev_hash + canonical(payload)).encode("utf-8")).hexdigest()


def _payload(row: dict) -> dict:
    """Hashed fields — everything except id/prev_hash/row_hash."""
    return {
        "seq": row["seq"],
        "employee_pseudonym": row["employee_pseudonym"],
        "department": row["department"],
        "tool_id": str(row["tool_id"]) if row["tool_id"] else None,
        "tool_domain": row["tool_domain"],
        "direction": row["direction"],
        "event_type": row["event_type"],
        "data_category": row["data_category"],
        "matrix_action": row["matrix_action"],
        "pattern_types": list(row["pattern_types"]),
        "masked_excerpt": row["masked_excerpt"],
        "degraded": row["degraded"],
        "created_at": row["created_at"],
    }


async def append_event(
    conn: DbConn, *, employee_pseudonym: str | None, department: str | None,
    tool_id, tool_domain: str | None, direction: str, event_type: str,
    data_category: str | None = None, matrix_action: str | None = None,
    pattern_types=(), masked_excerpt: str | None = None, degraded: bool = False,
    occurred_at: str | None = None,
) -> dict:
    """Append one event to the hash chain.

    occurred_at, if supplied, should be an ISO-8601 string: naive strings (no
    UTC offset) are treated as already-UTC; offset-aware strings are converted
    to UTC. This must match what asyncpg's timestamptz codec will store/return,
    since that same value is hashed into row_hash below.
    """
    async with conn.transaction():
        await conn.execute("select pg_advisory_xact_lock($1)", _LOCK_KEY)
        head = await conn.fetchrow(
            "select seq, row_hash from public.audit_events order by seq desc limit 1"
        )
        seq = (head["seq"] + 1) if head else 1
        prev_hash = head["row_hash"] if head else GENESIS_HASH
        # asyncpg's timestamptz codec requires a real datetime, not a str (even under
        # an explicit ::timestamptz cast) — bind the datetime object below, but hash the
        # same .isoformat() string that asyncpg will hand back on read (verify_chain
        # calls .isoformat() on the returned datetime too), so both sides match exactly.
        # Normalize to UTC-aware first: asyncpg always stores/returns timestamptz in
        # UTC, so an un-normalized offset (or a naive datetime silently reinterpreted
        # as server-local time) would hash a string that never round-trips.
        if occurred_at:
            dt = datetime.fromisoformat(occurred_at)
            created_at_dt = dt.astimezone(UTC) if dt.tzinfo else dt.replace(tzinfo=UTC)
        else:
            created_at_dt = datetime.now(UTC)
        created_at = created_at_dt.isoformat()
        row = {
            "seq": seq, "employee_pseudonym": employee_pseudonym, "department": department,
            "tool_id": tool_id, "tool_domain": tool_domain, "direction": direction,
            "event_type": event_type, "data_category": data_category,
            "matrix_action": matrix_action, "pattern_types": list(pattern_types),
            "masked_excerpt": masked_excerpt, "degraded": degraded, "created_at": created_at,
        }
        row_hash = compute_row_hash(prev_hash, _payload(row))
        await conn.execute(
            """insert into public.audit_events
               (seq, employee_pseudonym, department, tool_id, tool_domain, direction,
                event_type, data_category, matrix_action, pattern_types, masked_excerpt,
                degraded, prev_hash, row_hash, created_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz)""",
            seq, employee_pseudonym, department, tool_id, tool_domain, direction,
            event_type, data_category, matrix_action, list(pattern_types), masked_excerpt,
            degraded, prev_hash, row_hash, created_at_dt,
        )
        return {**row, "prev_hash": prev_hash, "row_hash": row_hash}


async def verify_chain(conn: DbConn) -> tuple[bool, int | None]:
    rows = await conn.fetch("select * from public.audit_events order by seq")
    prev = GENESIS_HASH
    for r in rows:
        d = dict(r)
        d["created_at"] = r["created_at"].isoformat()
        if r["prev_hash"] != prev or compute_row_hash(prev, _payload(d)) != r["row_hash"]:
            return False, r["seq"]
        prev = r["row_hash"]
    return True, None
