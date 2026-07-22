import httpx
import respx

from shieldgate.app import create_app
from shieldgate.config import Settings

TEST_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


async def test_health(app_client):
    resp = await app_client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["classifier_provider"] == "fake"
    assert body["inference_endpoint"] is None
    assert body["classifier_reachable"] is False


@respx.mock
async def test_health_reports_ollama_endpoint_when_configured():
    respx.post("http://127.0.0.1:11434/api/chat").mock(return_value=httpx.Response(200, json={
        "message": {"content": '{"category":"public","confidence":0.9,"reason":"warm-up"}'}}))
    settings = Settings(supabase_db_url=TEST_DB_URL, classifier_provider="ollama",
                        ollama_base_url="http://127.0.0.1:11434", _env_file=None)
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/health")
    body = resp.json()
    assert body["classifier_provider"] == "ollama"
    assert body["inference_endpoint"] == "http://127.0.0.1:11434"
    assert body["classifier_reachable"] is True
