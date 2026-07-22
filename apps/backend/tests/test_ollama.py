import json as _json

import httpx
import pytest
import respx

from shieldgate.classify.ollama import OllamaClassifier, probe_and_warm
from shieldgate.config import Settings

URL = "http://127.0.0.1:11434/api/chat"


def _resp(content: str):
    return httpx.Response(200, json={"message": {"content": content}})


@respx.mock
async def test_confident_confidential_finding():
    respx.post(URL).mock(return_value=_resp(
        '{"category":"confidential","confidence":0.9,"reason":"client term sheet"}'))
    async with httpx.AsyncClient() as c:
        r = await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")
    assert r == ("confidential", "client term sheet")


@respx.mock
async def test_public_returns_none():
    respx.post(URL).mock(return_value=_resp('{"category":"public","confidence":0.9,"reason":"n/a"}'))
    async with httpx.AsyncClient() as c:
        r = await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")
    assert r is None


@respx.mock
async def test_low_confidence_still_returns_finding():
    # The confidence gate is removed (PRD "Confidence gate" — measurement showed it never
    # fired, and the one wrong answer observed in prototyping was above the old 0.5
    # threshold, so it never separated correct from incorrect judgments).
    respx.post(URL).mock(return_value=_resp(
        '{"category":"confidential","confidence":0.2,"reason":"maybe"}'))
    async with httpx.AsyncClient() as c:
        r = await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")
    assert r == ("confidential", "maybe")


@respx.mock
async def test_unrecognized_category_is_returned_not_swallowed():
    # ollama.py does not validate the category value itself — that defensive "loud" check
    # lives in routes/classify.py so it can log a warning, mark degraded, and write an
    # audit event. This classifier just parses whatever the model returned.
    respx.post(URL).mock(return_value=_resp(
        '{"category":"Sensitive","confidence":0.9,"reason":"weird"}'))
    async with httpx.AsyncClient() as c:
        r = await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")
    assert r == ("Sensitive", "weird")


@respx.mock
async def test_missing_category_raises():
    respx.post(URL).mock(return_value=_resp('{"confidence":0.9,"reason":"malformed"}'))
    with pytest.raises(Exception):
        async with httpx.AsyncClient() as c:
            await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")


@respx.mock
async def test_http_error_raises():
    respx.post(URL).mock(return_value=httpx.Response(500))
    with pytest.raises(Exception):
        async with httpx.AsyncClient() as c:
            await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("...")


@respx.mock
async def test_request_sends_think_false_schema_format_and_keep_alive():
    captured = {}

    def capture(request):
        captured.update(_json.loads(request.content))
        return _resp('{"category":"public","confidence":0.9,"reason":"n/a"}')

    respx.post(URL).mock(side_effect=capture)
    async with httpx.AsyncClient() as c:
        await OllamaClassifier("http://127.0.0.1:11434", "gemma4:12b", client=c).classify_prompt("hello")
    assert captured["think"] is False
    assert captured["keep_alive"] == "30m"
    assert captured["format"]["properties"]["category"]["enum"] == [
        "public", "internal", "confidential", "restricted"]


@respx.mock
async def test_probe_and_warm_true_when_reachable():
    respx.post(URL).mock(return_value=_resp('{"category":"public","confidence":0.9,"reason":"warm-up"}'))
    settings = Settings(classifier_provider="ollama", ollama_base_url="http://127.0.0.1:11434",
                        ollama_model="gemma4:12b", _env_file=None)
    async with httpx.AsyncClient() as c:
        assert await probe_and_warm(settings, client=c) is True


@respx.mock
async def test_probe_and_warm_false_when_unreachable():
    respx.post(URL).mock(side_effect=httpx.ConnectError("refused"))
    settings = Settings(classifier_provider="ollama", ollama_base_url="http://127.0.0.1:11434",
                        ollama_model="gemma4:12b", _env_file=None)
    async with httpx.AsyncClient() as c:
        assert await probe_and_warm(settings, client=c) is False
