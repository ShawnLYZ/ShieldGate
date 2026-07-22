from shieldgate.classify.ollama import OllamaClassifier
from shieldgate.classify.providers import (
    FakeClassifier,
    RegexOnlyClassifier,
    get_classifier,
)
from shieldgate.config import Settings


def make(provider: str, **overrides) -> Settings:
    base = dict(classifier_provider=provider, _env_file=None)
    base.update(overrides)
    return Settings(**base)


def test_default_provider_is_regex_only():
    # regex-only is the shipped default: the accuracy eval measured clean-subset false
    # blocks with gemma4:12b (see config.py's comment for the run details). No cloud
    # classifier is reachable from shipped defaults either way (PRD "Classifier provider").
    assert Settings(_env_file=None).classifier_provider == "regex-only"


def test_default_ollama_endpoint_and_model():
    s = Settings(_env_file=None)
    assert s.ollama_base_url == "http://127.0.0.1:11434"
    assert s.ollama_model == "gemma4:12b"


def test_ollama_selected_when_reachable():
    assert isinstance(get_classifier(make("ollama"), reachable=True), OllamaClassifier)


def test_ollama_falls_back_to_regex_only_when_unreachable():
    # Unreachable at startup => declared regex-only for the whole process lifetime, never
    # attempted at request time (PRD "Availability, degradation, and warm-up").
    assert isinstance(get_classifier(make("ollama"), reachable=False), RegexOnlyClassifier)


def test_explicit_providers_still_selectable():
    assert isinstance(get_classifier(make("fake"), reachable=False), FakeClassifier)
    assert isinstance(get_classifier(make("regex-only"), reachable=True), RegexOnlyClassifier)
