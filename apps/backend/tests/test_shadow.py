import jwt

SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
ADMIN = "00000000-0000-0000-0000-0000000000a1"


def bearer(sub=ADMIN):
    return {"Authorization": f"Bearer {jwt.encode({'sub': sub, 'aud': 'authenticated'}, SECRET, algorithm='HS256')}"}


CSV = (
    "timestamp,user_email,application_name,domain,ip_address\n"
    "2026-07-01T09:12:00Z,alice@corp.example,Perplexity,perplexity.ai,10.0.0.1\n"
    "2026-07-02T10:00:00Z,bob@corp.example,Perplexity,perplexity.ai,10.0.0.2\n"
    "2026-07-03T11:30:00Z,carol@corp.example,Midjourney,midjourney.com,10.0.0.3\n"
    "2026-07-04T08:15:00Z,dave@corp.example,Claude,claude.ai,10.0.0.4\n"
)


def test_parse_dedupes_and_skips_known():
    from shieldgate.shadow import parse_idp_csv
    cands = {c.domain: c for c in parse_idp_csv(CSV, known_domains={"claude.ai"})}
    assert "claude.ai" not in cands            # already registered → skipped
    assert cands["perplexity.ai"].user_count == 2
    assert cands["perplexity.ai"].first_seen.isoformat() == "2026-07-01"


async def test_promote_non_uuid_id_returns_422(app_client):
    # a non-UUID path id previously hit asyncpg's codec and surfaced as a 500
    r = await app_client.post("/api/v1/shadow/not-a-uuid/promote", headers=bearer())
    assert r.status_code == 422


async def test_dismiss_non_uuid_id_returns_422(app_client):
    r = await app_client.post("/api/v1/shadow/not-a-uuid/dismiss", headers=bearer())
    assert r.status_code == 422


async def test_import_then_promote(app_client, db):
    files = {"file": ("idp.csv", CSV, "text/csv")}
    r = await app_client.post("/api/v1/shadow/import", headers=bearer(), files=files)
    assert r.status_code == 200 and r.json()["created"] >= 2
    assert r.json()["skipped_known"] == 1  # claude.ai is a registered tool domain
    cand = await db.fetchrow("select id from public.shadow_candidates where domain='perplexity.ai'")
    promo = await app_client.post(f"/api/v1/shadow/{cand['id']}/promote", headers=bearer())
    assert promo.status_code == 200
    row = await db.fetchrow("select status, promoted_request_id from public.shadow_candidates where id=$1", cand["id"])
    assert row["status"] == "promoted" and row["promoted_request_id"] is not None
