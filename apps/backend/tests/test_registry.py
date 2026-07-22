import jwt

SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
ADMIN = "00000000-0000-0000-0000-0000000000a1"


def bearer(sub):
    return {"Authorization": f"Bearer {jwt.encode({'sub': sub, 'aud': 'authenticated'}, SECRET, algorithm='HS256')}"}


async def test_matrix_edit_bumps_version(app_client, db):
    from shieldgate.policy.engine import current_policy_version
    original_action = await db.fetchval(
        "select action from public.policy_matrix where data_category='confidential' and tier=1")
    before = await current_policy_version(db)
    try:
        r = await app_client.patch("/api/v1/policy-matrix", headers=bearer(ADMIN),
            json={"cells": [{"data_category": "confidential", "tier": 1, "action": "block"}]})
        assert r.status_code == 200
        after = await current_policy_version(db)
        assert after == before + 1
        cell = await db.fetchval(
            "select action from public.policy_matrix where data_category='confidential' and tier=1")
        assert cell == "block"
    finally:
        # policy_matrix is a seed table conftest.py deliberately doesn't truncate;
        # restore it so a second consecutive suite run isn't polluted by this test.
        await db.execute(
            "update public.policy_matrix set action=$1 where data_category='confidential' and tier=1",
            original_action)


async def test_continuity_suspend_flags_tool(app_client, db):
    tool_id = await db.fetchval("select id from public.tools where name='ChatGPT'")
    original_status = await db.fetchval(
        "select continuity_status from public.tools where id=$1", tool_id)
    try:
        r = await app_client.post(f"/api/v1/tools/{tool_id}/continuity", headers=bearer(ADMIN),
            json={"status": "suspended", "note": "regulatory suspension (simulated)"})
        assert r.status_code == 200
        status = await db.fetchval("select continuity_status from public.tools where id=$1", tool_id)
        assert status == "suspended"
        ev = await db.fetchrow("select * from public.audit_events order by seq desc limit 1")
        assert ev["event_type"] == "continuity_change"
    finally:
        # tools is a seed table conftest.py deliberately doesn't truncate; restore
        # ChatGPT's continuity status so later/other test runs see the seed default.
        await db.execute(
            "update public.tools set continuity_status=$2, continuity_note=null where id=$1",
            tool_id, original_status)


async def test_matrix_edit_invalid_action_returns_422(app_client):
    # An invalid action reached the enum column and surfaced as a 500; typed cells
    # should reject it at the API boundary with 422.
    r = await app_client.patch("/api/v1/policy-matrix", headers=bearer(ADMIN),
        json={"cells": [{"data_category": "confidential", "tier": 1, "action": "bogus"}]})
    assert r.status_code == 422


async def test_matrix_edit_missing_field_returns_422(app_client):
    r = await app_client.patch("/api/v1/policy-matrix", headers=bearer(ADMIN),
        json={"cells": [{"data_category": "confidential", "tier": 1}]})
    assert r.status_code == 422


async def test_matrix_edit_out_of_range_tier_returns_422(app_client):
    # tier=5 previously reached the DB CHECK constraint and surfaced as a 500;
    # typed cells reject it at the API boundary.
    r = await app_client.patch("/api/v1/policy-matrix", headers=bearer(ADMIN),
        json={"cells": [{"data_category": "public", "tier": 5, "action": "allow"}]})
    assert r.status_code == 422


async def test_tool_create_out_of_range_tier_returns_422(app_client):
    r = await app_client.post("/api/v1/tools", headers=bearer(ADMIN),
        json={"name": "BadTier", "vendor": "BadTier", "domains": ["badtier.example"], "tier": 7})
    assert r.status_code == 422


async def test_tool_patch_non_uuid_id_returns_422(app_client):
    # a non-UUID path id previously hit asyncpg's codec and surfaced as a 500
    r = await app_client.patch("/api/v1/tools/not-a-uuid", headers=bearer(ADMIN),
        json={"tier": 1})
    assert r.status_code == 422


async def test_continuity_non_uuid_id_returns_422(app_client):
    r = await app_client.post("/api/v1/tools/not-a-uuid/continuity", headers=bearer(ADMIN),
        json={"status": "suspended"})
    assert r.status_code == 422


async def test_non_admin_forbidden(app_client):
    mgr = "00000000-0000-0000-0000-0000000000a2"
    r = await app_client.patch("/api/v1/policy-matrix", headers=bearer(mgr),
        json={"cells": [{"data_category": "public", "tier": 0, "action": "block"}]})
    assert r.status_code == 403


async def test_shieldgate_classifier_self_registered(db):
    row = await db.fetchrow("select * from public.tools where name='ShieldGate Classifier'")
    assert row is not None
    assert row["tier"] == 0
    assert row["vendor"] == "Self-hosted"
    assert row["dpa_status"] == "not applicable"
    assert list(row["capability_tags"]) == ["classification"]
    assert list(row["domains"]) == []
