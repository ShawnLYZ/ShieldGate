from shieldgate.routes.reports import compute_cost

MODEL = {"per_record_cost": 169,
         "records_at_risk": {"restricted": 500, "confidential": 100, "internal": 10, "public": 0},
         "action_multiplier": {"block": 1.0, "warn": 0.25, "allow": 0.0}}


def test_cost_formula():
    rows = [{"data_category": "restricted", "matrix_action": "block"},
            {"data_category": "confidential", "matrix_action": "warn"}]
    out = compute_cost(rows, MODEL)
    # 500*169*1.0 + 100*169*0.25 = 84500 + 4225 = 88725
    assert out["total"] == 88725
    assert out["per_category"]["restricted"] == 84500


async def test_cost_endpoint(app_client, db):
    # seed one block event
    from shieldgate.audit.chain import append_event
    from tests.test_approvals_api import bearer
    await append_event(db, employee_pseudonym="EMP-D3A1", department="Engineering", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="block",
                       data_category="restricted", matrix_action="block", pattern_types=["card"],
                       masked_excerpt="x")
    r = await app_client.get("/api/v1/reports/cost-avoidance",
                             headers=bearer("00000000-0000-0000-0000-0000000000a1", "admin@shieldgate.demo"))
    assert r.status_code == 200 and r.json()["total"] >= 84500
