import asyncio

INTERNAL = {"X-Internal-Key": "test-internal-key"}


async def test_concurrent_registrations_get_distinct_refs(app_client, db):
    # next_ref derived the number from the table's current max without reserving it,
    # so concurrent registrations computed the same ref and collided on the unique
    # index. Serializing allocation must let all N succeed with distinct refs.
    payload = {"subject_ref": "SUBJ-C", "system_name": "Triage", "model_used": "llama",
               "explanation_text": "a sufficiently long explanation for the race regression test"}
    n = 25
    results = await asyncio.gather(*[
        app_client.post("/api/v1/decisions", headers=INTERNAL, json=payload) for _ in range(n)
    ], return_exceptions=True)
    codes = [getattr(r, "status_code", repr(r)) for r in results]
    assert all(c == 200 for c in codes), f"expected all 200, got {codes}"
    refs = {r.json()["public_ref"] for r in results}
    assert len(refs) == n


async def test_register_requires_explanation(app_client):
    r = await app_client.post("/api/v1/decisions", headers=INTERNAL, json={
        "subject_ref": "SUBJ-1", "system_name": "Triage", "model_used": "llama", "explanation_text": "short"})
    assert r.status_code == 422  # < 20 chars


async def test_register_and_lookup_and_appeal(app_client):
    reg = await app_client.post("/api/v1/decisions", headers=INTERNAL, json={
        "subject_ref": "SUBJ-1", "system_name": "Triage", "model_used": "llama",
        "explanation_text": "Ranked lower urgency based on described self-serve match."})
    ref = reg.json()["public_ref"]
    assert ref.startswith("DR-2026-")

    look = await app_client.get(f"/api/v1/decisions/lookup?ref={ref}")
    assert look.status_code == 200 and look.json()["ai_involved"] is True
    assert "self-serve" in look.json()["explanation_text"]

    ap = await app_client.post(f"/api/v1/decisions/{ref}/appeals", json={"reason": "I think it's urgent."})
    ap_ref = ap.json()["public_ref"]
    assert ap_ref.startswith("AP-2026-")
    status = await app_client.get(f"/api/v1/appeals/{ap_ref}")
    assert status.json()["status"] == "open"


async def test_register_bad_key_rejected(app_client):
    r = await app_client.post("/api/v1/decisions", headers={"X-Internal-Key": "wrong"}, json={
        "subject_ref": "S", "system_name": "T", "model_used": "m",
        "explanation_text": "a sufficiently long explanation string"})
    assert r.status_code == 401


async def test_lookup_unknown_ref_404(app_client):
    assert (await app_client.get("/api/v1/decisions/lookup?ref=DR-2026-999999")).status_code == 404
