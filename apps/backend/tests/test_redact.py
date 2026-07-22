TOKEN = {"X-ShieldGate-Token": "sg-emp-demo-001"}


async def test_redacted_residual_passes_and_audits_consent(app_client, db):
    # Original card blocked; residual (masked) text should be allowed and logged as consent.
    r = await app_client.post("/api/v1/redact/confirm", headers=TOKEN, json={
        "text": "charge 4532-****-****-0366 today", "tool_domain": "localhost:5175",
    })
    body = r.json()
    assert body["action"] == "allow"  # no live card left in residual
    ev = await db.fetchrow("select * from public.audit_events order by seq desc limit 1")
    assert ev["event_type"] == "redacted_send"


async def test_clean_redacted_send_never_persists_raw_text(app_client, db):
    # A clean redacted-send (no residual matches) must NOT store raw prompt chars in the
    # audit excerpt — the global "never persist raw prompt bodies" invariant. mask_text over
    # zero matches returns the text unchanged, so a placeholder must be used instead.
    raw = "just a normal sentence with no secrets at all here today please"
    r = await app_client.post("/api/v1/redact/confirm", headers=TOKEN, json={
        "text": raw, "tool_domain": "localhost:5175",
    })
    assert r.json()["action"] == "allow"
    ev = await db.fetchrow("select * from public.audit_events order by seq desc limit 1")
    assert ev["event_type"] == "redacted_send"
    excerpt = ev["masked_excerpt"] or ""
    assert "normal sentence" not in excerpt
    assert excerpt.startswith("[redacted send:")


async def test_redacted_but_still_dirty_stays_blocked(app_client):
    r = await app_client.post("/api/v1/redact/confirm", headers=TOKEN, json={
        # 4916-9012-3456-7893 is Luhn-valid (unlike the visually similar ...7894), so it
        # still matches as a live card in the residual scan — the case this test exercises.
        "text": "cards 4532-****-****-0366 and 4916-9012-3456-7893", "tool_domain": "localhost:5175",
    })
    assert r.json()["action"] == "block"  # second card is live → still restricted on tier 0
