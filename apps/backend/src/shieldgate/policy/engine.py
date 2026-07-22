from dataclasses import dataclass, field
from uuid import UUID


from shieldgate.classify.patterns import PatternMatch
from shieldgate.db import DbConn

SEVERITY = {"public": 0, "internal": 1, "confidential": 2, "restricted": 3}


@dataclass(frozen=True)
class ToolRow:
    id: UUID | None
    name: str
    tier: int
    continuity_status: str
    capability_tags: list[str] = field(default_factory=list)
    fallback_tool_id: UUID | None = None


def resolve_category(matches: list[PatternMatch], llm_category: str | None = None) -> str:
    best = "public"
    if matches:
        best = "restricted"  # every Phase 1 pattern maps to restricted
    if llm_category and SEVERITY.get(llm_category, -1) > SEVERITY[best]:
        best = llm_category
    return best


async def load_matrix(conn: DbConn) -> dict[tuple[str, int], str]:
    rows = await conn.fetch("select data_category, tier, action from public.policy_matrix")
    return {(r["data_category"], r["tier"]): r["action"] for r in rows}


def matrix_action(matrix: dict[tuple[str, int], str], category: str, tier: int) -> str:
    return matrix[(category, tier)]


def effective_tier(tool: ToolRow) -> int:
    """Continuity suspension overrides a tool's effective tier to 0 — every sensitive
    category blocks, only public passes (design §1: FastAPI is the single policy brain;
    PRD: suspension overrides the tool's effective tier to blocked)."""
    if tool.continuity_status == "suspended":
        return 0
    return tool.tier


async def resolve_tool(conn: DbConn, domain: str) -> ToolRow:
    row = await conn.fetchrow(
        "select id, name, tier, continuity_status, capability_tags, fallback_tool_id "
        "from public.tools where $1 = any(domains)",
        domain,
    )
    if row is None:
        return ToolRow(id=None, name=domain, tier=0, continuity_status="active")
    return ToolRow(row["id"], row["name"], row["tier"], row["continuity_status"],
                   list(row["capability_tags"] or []), row["fallback_tool_id"])


async def current_policy_version(conn: DbConn) -> int:
    # coalesce guarantees a value; `or 0` narrows fetchval's Any | None for the
    # declared return type without pretending a null could be meaningful here.
    version = await conn.fetchval("select coalesce(max(version), 0) from public.policy_versions")
    return int(version or 0)


async def bump_policy_version(conn: DbConn, reason: str) -> int:
    version = await conn.fetchval(
        "insert into public.policy_versions (reason) values ($1) returning version", reason
    )
    return int(version or 0)
