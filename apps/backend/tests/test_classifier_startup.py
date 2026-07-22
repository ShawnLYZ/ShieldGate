import httpx
import respx

from shieldgate.app import create_app
from shieldgate.config import Settings

TEST_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
CHAT_URL = "http://127.0.0.1:11434/api/chat"


def ollama_settings(**overrides) -> Settings:
    base = dict(supabase_db_url=TEST_DB_URL, classifier_provider="ollama",
                ollama_base_url="http://127.0.0.1:11434", _env_file=None)
    base.update(overrides)
    return Settings(**base)


@respx.mock
async def test_reachable_ollama_sets_classifier_reachable_true():
    respx.post(CHAT_URL).mock(return_value=httpx.Response(200, json={
        "message": {"content": '{"category":"public","confidence":0.9,"reason":"warm-up"}'}}))
    app = create_app(ollama_settings())
    async with app.router.lifespan_context(app):
        assert app.state.classifier_reachable is True


@respx.mock
async def test_unreachable_ollama_sets_classifier_reachable_false():
    respx.post(CHAT_URL).mock(side_effect=httpx.ConnectError("refused"))
    app = create_app(ollama_settings())
    async with app.router.lifespan_context(app):
        assert app.state.classifier_reachable is False


async def test_non_ollama_provider_is_never_marked_reachable():
    app = create_app(ollama_settings(classifier_provider="regex-only"))
    async with app.router.lifespan_context(app):
        assert app.state.classifier_reachable is False
