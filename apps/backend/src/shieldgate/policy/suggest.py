import asyncpg

from shieldgate.db import DbConn

_SELECT = "select id, name, domains, tier from public.tools"


def _to_suggestion(row: asyncpg.Record) -> dict:
    return {"tool_id": str(row["id"]), "name": row["name"],
            "domain": row["domains"][0] if row["domains"] else ""}


async def suggest_tool(conn: DbConn, needed_capability: str | None, *,
                       exclude_tool_id=None, fallback_tool_id=None) -> dict | None:
    """Try-this-instead resolution (design §7): the tool's explicit fallback override
    wins when it is actually usable (approved tier >= 1, continuity-active) — a Tier-0
    or suspended fallback is only meaningful for the continuity banner, not as a
    steer-here suggestion. Otherwise: highest-tier active tool sharing the capability,
    never the tool the user was just warned/blocked on."""
    if fallback_tool_id is not None:
        row = await conn.fetchrow(
            f"{_SELECT} where id=$1 and tier >= 1 and continuity_status='active'",
            fallback_tool_id)
        if row is not None:
            return _to_suggestion(row)
    # cap="chat" already covers "capability unknown" (needed_capability is None); a specific,
    # unmatched capability must return None rather than falling back to chat.
    cap = needed_capability or "chat"
    row = await conn.fetchrow(
        f"""{_SELECT}
            where tier >= 1 and continuity_status = 'active' and $1 = any(capability_tags)
              and ($2::uuid is null or id <> $2)
            order by tier desc, name limit 1""", cap, exclude_tool_id)
    return None if row is None else _to_suggestion(row)
