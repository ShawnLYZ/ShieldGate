import asyncpg
from fastapi import APIRouter, Depends

from shieldgate.db import get_pool
from shieldgate.jwt_auth import AuthUser, require_user

router = APIRouter(tags=["reports"])


def compute_cost(rows: list[dict], model: dict) -> dict:
    per_category: dict[str, float] = {}
    for r in rows:
        cat = r["data_category"]
        act = r["matrix_action"]
        if not cat or not act:
            continue
        records = model["records_at_risk"].get(cat, 0)
        mult = model["action_multiplier"].get(act, 0)
        per_category[cat] = per_category.get(cat, 0) + records * model["per_record_cost"] * mult
    per_category = {k: round(v) for k, v in per_category.items()}
    return {"total": round(sum(per_category.values())), "per_category": per_category}


@router.get("/reports/cost-avoidance")
async def cost_avoidance(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    model = await pool.fetchval("select value from public.app_settings where key='cost_model'")
    rows = await pool.fetch(
        "select data_category, matrix_action from public.audit_events "
        "where matrix_action in ('block','warn') and created_at >= date_trunc('month', now())")
    result = compute_cost([dict(r) for r in rows], model)
    return {**result, "formula": "Σ records_at_risk[category] · per_record_cost · action_multiplier",
            "assumptions": model}


@router.get("/reports/executive")
async def executive(user: AuthUser = Depends(require_user), pool: asyncpg.Pool = Depends(get_pool)):
    model = await pool.fetchval("select value from public.app_settings where key='cost_model'")
    rows = await pool.fetch("select data_category, matrix_action, department, created_at "
                            "from public.audit_events where matrix_action in ('block','warn')")
    # Cost/exposure is a monthly counter; incidents + trend below stay all-time.
    cost_rows = await pool.fetch(
        "select data_category, matrix_action from public.audit_events "
        "where matrix_action in ('block','warn') and created_at >= date_trunc('month', now())")
    cost = compute_cost([dict(r) for r in cost_rows], model)
    incidents = len(rows)
    by_dept: dict[str, int] = {}
    for r in rows:
        by_dept[r["department"] or "—"] = by_dept.get(r["department"] or "—", 0) + 1
    appeals = await pool.fetchrow(
        "select count(*) filter (where status='resolved') resolved, count(*) total from public.appeals")
    trend_rows = await pool.fetch(
        "select to_char(created_at::date,'YYYY-MM-DD') as date, count(*) as incidents "
        "from public.audit_events where matrix_action in ('block','warn') "
        "group by created_at::date order by created_at::date")
    risk_trend = [{"date": r["date"], "incidents": r["incidents"]} for r in trend_rows]
    return {"incidents_avoided": incidents, "exposure_avoided": cost["total"],
            "per_category": cost["per_category"], "top_departments": by_dept,
            "appeals_summary": {"resolved": appeals["resolved"], "total": appeals["total"]},
            "risk_trend": risk_trend}
