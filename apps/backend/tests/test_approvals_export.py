import csv
import io

import jwt

SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
ADMIN = "00000000-0000-0000-0000-0000000000a1"
MANAGER = "00000000-0000-0000-0000-0000000000a2"
EMPLOYEE = "00000000-0000-0000-0000-0000000000a3"


def bearer(sub):
    tok = jwt.encode({"sub": sub, "aud": "authenticated"}, SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


async def _submit(app_client, token, name, url):
    r = await app_client.post("/api/v1/approvals", headers={"X-ShieldGate-Token": token},
                              json={"tool_name": name, "tool_url": url,
                                    "purpose": "team productivity work"})
    assert r.status_code == 200
    return r.json()["id"]


async def test_export_shows_reviewers_timestamps_and_tier(app_client, db):
    # Stories 51/53: approval decisions must be exportable with reviewers,
    # timestamps, and the assigned tier — accountability traceable to people.
    rid = await _submit(app_client, "sg-emp-demo-001", "ExportTool", "https://exporttool.example")
    await app_client.post(f"/api/v1/approvals/{rid}/decision", headers=bearer(MANAGER),
                          json={"decision": "approve", "tier": 1})
    await app_client.post(f"/api/v1/approvals/{rid}/decision", headers=bearer(ADMIN),
                          json={"decision": "approve", "tier": 1})
    r = await app_client.get("/api/v1/approvals/export.csv", headers=bearer(ADMIN))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(r.text)))
    row = next(x for x in rows if x["tool_name"] == "ExportTool")
    assert row["status"] == "approved"
    assert row["manager_reviewer_name"] == "Demo Manager"
    assert row["admin_reviewer_name"] == "Demo Admin"
    assert row["assigned_tier"] == "1"
    assert row["manager_decided_at"] and row["admin_decided_at"]


async def test_export_manager_scoped_to_own_department(app_client, db):
    await _submit(app_client, "sg-emp-demo-001", "EngOnlyTool", "https://engonly.example")
    await _submit(app_client, "sg-emp-demo-003", "FinOnlyTool", "https://finonly.example")
    r = await app_client.get("/api/v1/approvals/export.csv", headers=bearer(MANAGER))
    assert r.status_code == 200
    assert "EngOnlyTool" in r.text
    assert "FinOnlyTool" not in r.text


async def test_export_forbidden_for_employee_jwt(app_client):
    r = await app_client.get("/api/v1/approvals/export.csv", headers=bearer(EMPLOYEE))
    assert r.status_code == 403


async def test_list_includes_reviewer_display_names(app_client, db):
    # The queue UI renders the decision trail from the backend list, which joins
    # reviewer display names (profile UUIDs alone are not an auditor surface).
    rid = await _submit(app_client, "sg-emp-demo-001", "NameTool", "https://nametool.example")
    await app_client.post(f"/api/v1/approvals/{rid}/decision", headers=bearer(MANAGER),
                          json={"decision": "approve", "tier": 1})
    listing = await app_client.get("/api/v1/approvals", headers=bearer(ADMIN))
    row = next(x for x in listing.json() if x["tool_name"] == "NameTool")
    assert row["manager_reviewer_name"] == "Demo Manager"
    assert row["admin_reviewer_name"] is None
