from tests.test_registry import ADMIN, bearer

MANAGER = "00000000-0000-0000-0000-0000000000a2"

INTERNAL = {"X-Internal-Key": "test-internal-key"}


async def test_admin_lists_decisions_and_appeals(app_client, db):
    reg = await app_client.post("/api/v1/decisions", headers=INTERNAL, json={
        "subject_ref": "SUBJ-1", "system_name": "Triage", "model_used": "llama",
        "explanation_text": "Ranked lower urgency based on described self-serve match."})
    ref = reg.json()["public_ref"]
    ap = await app_client.post(f"/api/v1/decisions/{ref}/appeals", json={"reason": "I think it's urgent."})
    ap_ref = ap.json()["public_ref"]

    decisions = await app_client.get("/api/v1/decisions", headers=bearer(ADMIN))
    assert decisions.status_code == 200
    assert any(d["public_ref"] == ref for d in decisions.json())

    appeals = await app_client.get("/api/v1/appeals", headers=bearer(ADMIN))
    assert appeals.status_code == 200
    row = next(a for a in appeals.json() if a["public_ref"] == ap_ref)
    assert row["decision_ref"] == ref
    assert row["status"] == "open"


async def test_admin_resolves_appeal_and_is_authz_gated(app_client, db):
    reg = await app_client.post("/api/v1/decisions", headers=INTERNAL, json={
        "subject_ref": "SUBJ-R", "system_name": "Triage", "model_used": "llama",
        "explanation_text": "Ranked lower urgency based on described self-serve match."})
    ref = reg.json()["public_ref"]
    ap = await app_client.post(f"/api/v1/decisions/{ref}/appeals",
                               json={"reason": "I believe this needs a human re-review."})
    ap_ref = ap.json()["public_ref"]
    appeal_id = await db.fetchval("select id::text from public.appeals where public_ref=$1", ap_ref)

    forbidden = await app_client.post(f"/api/v1/appeals/{appeal_id}/resolve",
                                      headers=bearer(MANAGER), json={"note": "no"})
    assert forbidden.status_code == 403

    r = await app_client.post(f"/api/v1/appeals/{appeal_id}/resolve",
                              headers=bearer(ADMIN), json={"note": "reviewed and upheld"})
    assert r.status_code == 200 and r.json()["status"] == "resolved"

    status = await app_client.get(f"/api/v1/appeals/{ap_ref}")
    assert status.json()["status"] == "resolved"


async def test_manager_forbidden(app_client, db):
    decisions = await app_client.get("/api/v1/decisions", headers=bearer(MANAGER))
    assert decisions.status_code == 403
    appeals = await app_client.get("/api/v1/appeals", headers=bearer(MANAGER))
    assert appeals.status_code == 403
