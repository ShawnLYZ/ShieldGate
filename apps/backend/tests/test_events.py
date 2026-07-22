TOKEN = {"X-ShieldGate-Token": "sg-emp-demo-001"}


async def test_batch_ingest_chains_events(app_client, db):
    batch = {"events": [
        {"event_type": "allow_usage", "direction": "prompt",
         "tool_domain": "claude.ai", "data_category": "public", "matrix_action": "allow"},
        {"event_type": "block", "direction": "prompt", "tool_domain": "localhost:5175",
         "data_category": "restricted", "matrix_action": "block",
         "pattern_types": ["card"], "masked_excerpt": "4532-****-****-0366", "degraded": True},
    ]}
    r = await app_client.post("/api/v1/events", headers=TOKEN, json=batch)
    assert r.status_code == 200 and r.json() == {"accepted": 2}
    rows = await db.fetch("select * from public.audit_events order by seq")
    assert [x["event_type"] for x in rows] == ["allow_usage", "block"]
    assert rows[1]["prev_hash"] == rows[0]["row_hash"]
    assert all(x["employee_pseudonym"] == "EMP-D3A1" for x in rows)


async def test_empty_batch_rejected(app_client):
    r = await app_client.post("/api/v1/events", headers=TOKEN, json={"events": []})
    assert r.status_code == 422
