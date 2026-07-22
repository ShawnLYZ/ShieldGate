TOKEN = {"X-ShieldGate-Token": "sg-emp-demo-001"}


async def test_snapshot_shape_and_etag(app_client):
    r = await app_client.get("/api/v1/policy/snapshot", headers=TOKEN)
    assert r.status_code == 200
    body = r.json()
    assert len(body["matrix"]) == 12
    names = {t["name"] for t in body["tools"]}
    assert {"ChatGPT", "Claude", "Gemini", "Mock AI Chat"} <= names
    assert r.headers["etag"] == f'W/"v{body["version"]}"'


async def test_snapshot_304_on_match(app_client):
    first = await app_client.get("/api/v1/policy/snapshot", headers=TOKEN)
    again = await app_client.get("/api/v1/policy/snapshot",
                                 headers={**TOKEN, "If-None-Match": first.headers["etag"]})
    assert again.status_code == 304


async def test_snapshot_requires_token(app_client):
    assert (await app_client.get("/api/v1/policy/snapshot")).status_code == 401
