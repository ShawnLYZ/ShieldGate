from shieldgate.audit.chain import append_event
from shieldgate.policy.engine import current_policy_version
from tests.test_registry import ADMIN, bearer

MANAGER = "00000000-0000-0000-0000-0000000000a2"


async def test_executive_report_includes_risk_trend(app_client, db):
    await append_event(db, employee_pseudonym="EMP-D3A1", department="Engineering", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="block",
                       data_category="restricted", matrix_action="block", pattern_types=["card"],
                       masked_excerpt="x")
    await append_event(db, employee_pseudonym="EMP-9B10", department="Finance", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="warn",
                       data_category="confidential", matrix_action="warn", pattern_types=["card"],
                       masked_excerpt="y")

    r = await app_client.get("/api/v1/reports/executive", headers=bearer(ADMIN))

    assert r.status_code == 200
    body = r.json()
    assert "risk_trend" in body
    assert isinstance(body["risk_trend"], list)
    assert len(body["risk_trend"]) > 0
    for point in body["risk_trend"]:
        assert "date" in point
        assert "incidents" in point


async def test_executive_cost_counter_is_current_month_only(app_client, db):
    # exposure_avoided is a cost counter; a block event from a prior month must not
    # inflate the current month's figure (the review flagged it as all-time).
    await append_event(db, employee_pseudonym="EMP-D3A1", department="Engineering", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="block",
                       data_category="restricted", matrix_action="block", pattern_types=["card"],
                       masked_excerpt="x")
    # Backdate the only event to the last day of the previous month.
    await db.execute(
        "update public.audit_events set created_at = date_trunc('month', now()) - interval '1 day'")
    r = await app_client.get("/api/v1/reports/executive", headers=bearer(ADMIN))
    assert r.json()["exposure_avoided"] == 0  # nothing this month yet

    # A current-month block event does count.
    await append_event(db, employee_pseudonym="EMP-D3A1", department="Engineering", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="block",
                       data_category="restricted", matrix_action="block", pattern_types=["card"],
                       masked_excerpt="y")
    r2 = await app_client.get("/api/v1/reports/executive", headers=bearer(ADMIN))
    assert r2.json()["exposure_avoided"] > 0


async def test_executive_cost_uses_edited_assumptions(app_client, db):
    # Editing the cost_model assumptions must flow into the executive exposure figure.
    await append_event(db, employee_pseudonym="EMP-D3A1", department="Engineering", tool_id=None,
                       tool_domain="localhost:5175", direction="prompt", event_type="block",
                       data_category="restricted", matrix_action="block", pattern_types=["card"],
                       masked_excerpt="x")
    base = (await app_client.get("/api/v1/reports/executive", headers=bearer(ADMIN))).json()["exposure_avoided"]
    assert base > 0
    model = await db.fetchval("select value from public.app_settings where key='cost_model'")
    edited = dict(model)
    edited["per_record_cost"] = model["per_record_cost"] * 2
    try:
        await app_client.patch("/api/v1/settings/cost_model", headers=bearer(ADMIN), json={"value": edited})
        after = (await app_client.get("/api/v1/reports/executive",
                                      headers=bearer(ADMIN))).json()["exposure_avoided"]
        assert after == base * 2
    finally:
        await app_client.patch("/api/v1/settings/cost_model", headers=bearer(ADMIN),
                               json={"value": dict(model)})


async def test_patch_settings_upserts_app_settings_without_bumping_policy_version(app_client, db):
    before = await current_policy_version(db)
    try:
        r = await app_client.patch("/api/v1/settings/test_scratch_setting", headers=bearer(ADMIN),
            json={"value": {"foo": "bar"}})
        assert r.status_code == 200
        assert r.json() == {"ok": True, "key": "test_scratch_setting"}

        value = await db.fetchval(
            "select value from public.app_settings where key='test_scratch_setting'")
        assert value == {"foo": "bar"}

        after = await current_policy_version(db)
        assert after == before

        ev = await db.fetchval("select count(*) from public.audit_events")
        assert ev == 0
    finally:
        await db.execute("delete from public.app_settings where key='test_scratch_setting'")


async def test_patch_settings_non_admin_forbidden(app_client, db):
    r = await app_client.patch("/api/v1/settings/test_scratch_setting", headers=bearer(MANAGER),
        json={"value": {"foo": "bar"}})
    assert r.status_code == 403


async def test_get_setting_roundtrips_and_404s(app_client, db):
    missing = await app_client.get("/api/v1/settings/test_scratch_setting", headers=bearer(ADMIN))
    assert missing.status_code == 404
    try:
        await app_client.patch("/api/v1/settings/test_scratch_setting", headers=bearer(ADMIN),
            json={"value": {"foo": "bar"}})
        got = await app_client.get("/api/v1/settings/test_scratch_setting", headers=bearer(ADMIN))
        assert got.status_code == 200
        assert got.json() == {"key": "test_scratch_setting", "value": {"foo": "bar"}}

        forbidden = await app_client.get("/api/v1/settings/test_scratch_setting", headers=bearer(MANAGER))
        assert forbidden.status_code == 403
    finally:
        await db.execute("delete from public.app_settings where key='test_scratch_setting'")
