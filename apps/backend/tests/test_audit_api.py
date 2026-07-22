import jwt

SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
ADMIN = "00000000-0000-0000-0000-0000000000a1"
MGR = "00000000-0000-0000-0000-0000000000a2"


def bearer(sub):
    return {"Authorization": f"Bearer {jwt.encode({'sub': sub, 'aud': 'authenticated'}, SECRET, algorithm='HS256')}"}


async def _seed(db, n=3, dept="Engineering"):
    from shieldgate.audit.chain import append_event
    for i in range(n):
        await append_event(db, employee_pseudonym="EMP-D3A1", department=dept, tool_id=None,
                           tool_domain="localhost:5175", direction="prompt", event_type="block",
                           data_category="restricted", matrix_action="block",
                           pattern_types=["card"], masked_excerpt=f"m{i}")


async def test_admin_sees_all_manager_scoped(app_client, db):
    await _seed(db, 2, "Engineering")
    await _seed(db, 1, "Finance")
    admin = await app_client.get("/api/v1/audit", headers=bearer(ADMIN))
    mgr = await app_client.get("/api/v1/audit", headers=bearer(MGR))
    assert len(admin.json()["items"]) == 3
    assert all(x["department"] == "Engineering" for x in mgr.json()["items"])


async def test_export_csv_includes_hashes(app_client, db):
    await _seed(db, 1)
    r = await app_client.get("/api/v1/audit/export.csv", headers=bearer(ADMIN))
    assert r.status_code == 200 and "text/csv" in r.headers["content-type"]
    assert "row_hash" in r.text and "prev_hash" in r.text


async def test_verify_ok_then_tamper(app_client, db):
    await _seed(db, 3)
    ok = await app_client.get("/api/v1/audit/verify", headers=bearer(ADMIN))
    assert ok.json()["ok"] is True
    await db.execute("update public.audit_events set masked_excerpt='forged' where seq=2")
    bad = await app_client.get("/api/v1/audit/verify", headers=bearer(ADMIN))
    assert bad.json()["ok"] is False and bad.json()["first_bad_seq"] == 2
