TOKEN = {"X-ShieldGate-Token": "sg-emp-demo-001"}


async def test_register_then_verify_by_id_and_by_text(app_client):
    reg = await app_client.post("/api/v1/provenance", headers=TOKEN,
                                json={"text": "Drafted summary of Q3 results.", "tool_domain": "claude.ai"})
    body = reg.json()
    ref, footer = body["public_ref"], body["footer"]
    assert ref.startswith("PV-2026-")
    assert ref in footer and "AI-assisted" in footer

    by_id = await app_client.get(f"/api/v1/provenance/verify?id={ref}")
    assert by_id.json()["public_ref"] == ref

    # Text WITH footer appended still matches (footer stripped before hashing).
    with_footer = "Drafted summary of Q3 results." + footer
    by_text = await app_client.post("/api/v1/provenance/verify", json={"text": with_footer})
    assert by_text.json()["public_ref"] == ref

    # Exact original text matches too.
    exact = await app_client.post("/api/v1/provenance/verify", json={"text": "Drafted summary of Q3 results."})
    assert exact.json()["public_ref"] == ref


async def test_unknown_text_no_match(app_client):
    r = await app_client.post("/api/v1/provenance/verify", json={"text": "never registered"})
    assert r.json()["match"] is False
