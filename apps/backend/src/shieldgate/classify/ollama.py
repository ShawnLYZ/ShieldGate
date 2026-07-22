import json

import httpx

from shieldgate.config import Settings

SYSTEM = (
    "You are a data-classification engine for an enterprise DLP tool. "
    "Classify the sensitivity of the user's text into exactly one of: "
    "public, internal, confidential, restricted. Consider context, not just keywords "
    "(e.g. a client term sheet is confidential even without card numbers). "
    "Respond only with the requested JSON."
)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": ["public", "internal", "confidential", "restricted"]},
        "confidence": {"type": "number"},
        "reason": {"type": "string"},
    },
    "required": ["category", "confidence", "reason"],
}

PROBE_TEXT = "System warm-up check: respond with the public data category."


class OllamaClassifier:
    def __init__(self, base_url: str, model: str, client: httpx.AsyncClient | None = None):
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = client

    async def classify_prompt(self, text: str):
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": text[:6000]}],
            "format": RESPONSE_SCHEMA,
            "think": False,
            "keep_alive": "30m",
            "stream": False,
            "options": {"temperature": 0},
        }
        url = f"{self._base_url}/api/chat"
        owns = self._client is None
        client = self._client or httpx.AsyncClient(timeout=15.0)
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            content = resp.json()["message"]["content"]
        finally:
            if owns:
                await client.aclose()
        data = json.loads(content)
        category = data["category"]
        if category != "public":
            return (category, data.get("reason", "context-based finding"))
        return None


async def probe_and_warm(settings: Settings, client: httpx.AsyncClient | None = None) -> bool:
    try:
        await OllamaClassifier(settings.ollama_base_url, settings.ollama_model, client) \
            .classify_prompt(PROBE_TEXT)
        return True
    except Exception:
        return False
