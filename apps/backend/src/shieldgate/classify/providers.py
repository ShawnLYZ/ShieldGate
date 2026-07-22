from typing import Protocol

from shieldgate.config import Settings

LlmFinding = tuple[str, str]  # (category, reason)


class Classifier(Protocol):
    async def classify_prompt(self, text: str) -> LlmFinding | None: ...


class RegexOnlyClassifier:
    async def classify_prompt(self, text: str) -> LlmFinding | None:
        return None


class FakeClassifier:
    async def classify_prompt(self, text: str) -> LlmFinding | None:
        if "[[CONFIDENTIAL]]" in text:
            return ("confidential", "test finding")
        if "[[INTERNAL]]" in text:
            return ("internal", "test finding")
        return None


def get_classifier(settings: Settings, reachable: bool) -> Classifier:
    if settings.classifier_provider == "fake":
        return FakeClassifier()
    if settings.classifier_provider == "ollama" and reachable:
        from .ollama import OllamaClassifier
        return OllamaClassifier(settings.ollama_base_url, settings.ollama_model)
    return RegexOnlyClassifier()
