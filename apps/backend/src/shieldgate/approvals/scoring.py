from dataclasses import dataclass


from shieldgate.db import DbConn


@dataclass(frozen=True)
class ScoreResult:
    score: int
    signals: dict
    recommended_tier: int


def compute_score(signals: dict, weights: dict) -> int:
    total = 0
    if signals.get("soc2"):
        total += weights["soc2"]
    if signals.get("iso27001"):
        total += weights["iso27001"]
    if signals.get("dpa_published"):
        total += weights["dpa_published"]
    if int(signals.get("breach_history_count", 0)) == 0:
        total += weights["clean_breach_history"]
    if signals.get("enterprise_offering"):
        total += weights["enterprise_offering"]
    return max(0, min(100, total))


def band_to_tier(score: int) -> int:
    if score >= 70:
        return 2
    if score >= 40:
        return 1
    return 0


async def score_vendor(conn: DbConn, tool_name: str, tool_url: str | None) -> ScoreResult:
    raw = await conn.fetchval("select value from public.app_settings where key='risk_weights'")
    # jsonb comes back already decoded by the pool's type codec (db._init); the
    # dict() branch covers a connection without it (scripts, ad-hoc callers).
    weights: dict = raw if isinstance(raw, dict) else dict(raw or {})
    # Match by domain substring or vendor-name token.
    row = await conn.fetchrow(
        """select * from public.vendor_signals
           where ($2::text is not null and position(domain in $2::text) > 0)
              or lower($1) like '%' || lower(vendor) || '%'
           order by length(vendor) desc limit 1""",
        tool_name, tool_url or "",
    )
    if row is None:
        # Unknown vendor: we have no evidence of trustworthiness. Do NOT credit the
        # clean-breach-history bonus off the default count of 0 — an unknown vendor
        # scores 0 and lands at tier 0.
        unknown = {"soc2": False, "iso27001": False, "dpa_published": False,
                   "breach_history_count": 0, "enterprise_offering": False}
        return ScoreResult(score=0, signals=unknown, recommended_tier=0)
    signals = dict(row)
    score = compute_score(signals, weights)
    return ScoreResult(score=score, signals=signals, recommended_tier=band_to_tier(score))
