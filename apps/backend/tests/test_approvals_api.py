import jwt

SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"


def bearer(sub, role_email):
    tok = jwt.encode({"sub": sub, "aud": "authenticated", "role": "authenticated",
                      "email": role_email}, SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


async def test_employee_can_submit_via_token(app_client):
    r = await app_client.post("/api/v1/approvals",
        headers={"X-ShieldGate-Token": "sg-emp-demo-001"},
        json={"tool_name": "Perplexity", "tool_url": "https://perplexity.ai", "purpose": "research"})
    assert r.status_code == 200 and r.json()["status"] == "triaged"


async def test_admin_lists_all(app_client):
    admin_id = "00000000-0000-0000-0000-0000000000a1"
    r = await app_client.get("/api/v1/approvals", headers=bearer(admin_id, "admin@shieldgate.demo"))
    assert r.status_code == 200 and isinstance(r.json(), list)


async def test_decision_invalid_verb_returns_422(app_client, db):
    # free-text decision verbs previously flowed into the SQL update; typed Literal
    # rejects unknown verbs at the boundary.
    admin_id = "00000000-0000-0000-0000-0000000000a1"
    created = await app_client.post("/api/v1/approvals",
        headers={"X-ShieldGate-Token": "sg-emp-demo-001"},
        json={"tool_name": "VerbTool", "tool_url": "https://verbtool.example", "purpose": "testing"})
    r = await app_client.post(f"/api/v1/approvals/{created.json()['id']}/decision",
        headers=bearer(admin_id, "admin@shieldgate.demo"), json={"decision": "maybe"})
    assert r.status_code == 422


async def test_decision_non_uuid_request_id_returns_422(app_client):
    # a non-UUID path id previously hit asyncpg's codec and surfaced as a 500
    admin_id = "00000000-0000-0000-0000-0000000000a1"
    r = await app_client.post("/api/v1/approvals/not-a-uuid/decision",
        headers=bearer(admin_id, "admin@shieldgate.demo"), json={"decision": "approve"})
    assert r.status_code == 422


async def test_info_non_uuid_request_id_returns_422(app_client):
    r = await app_client.post("/api/v1/approvals/not-a-uuid/info",
        headers={"X-ShieldGate-Token": "sg-emp-demo-001"}, json={"note": "more details"})
    assert r.status_code == 422


async def test_employee_token_lists_only_own_requests(app_client, db):
    # Story 9: an employee authenticates with a token, not a JWT, and must be able to
    # list their own requests — scoped to just theirs.
    t1 = {"X-ShieldGate-Token": "sg-emp-demo-001"}  # EMP-D3A1
    t2 = {"X-ShieldGate-Token": "sg-emp-demo-002"}  # EMP-7C42
    await app_client.post("/api/v1/approvals", headers=t1, json={
        "tool_name": "MyToolNine", "tool_url": "https://mytoolnine.example", "purpose": "analysis of data"})
    await app_client.post("/api/v1/approvals", headers=t2, json={
        "tool_name": "OtherToolNine", "tool_url": "https://othertoolnine.example", "purpose": "some other work"})
    listing = await app_client.get("/api/v1/approvals", headers=t1)
    assert listing.status_code == 200
    rows = listing.json()
    assert rows, "employee should see their own request"
    assert all(row["requested_by_pseudonym"] == "EMP-D3A1" for row in rows)
    assert any(row["tool_name"] == "MyToolNine" for row in rows)
