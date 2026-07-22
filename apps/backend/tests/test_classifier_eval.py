import json
from pathlib import Path

import pytest

from shieldgate.classify.ollama import OllamaClassifier
from shieldgate.config import get_settings

pytestmark = pytest.mark.eval

CORPUS_PATH = Path(__file__).parent / "fixtures" / "classifier_eval_corpus.json"


def load_corpus() -> list[dict]:
    return json.loads(CORPUS_PATH.read_text(encoding="utf-8"))


async def test_classifier_accuracy_and_clean_subset_zero_false_blocks():
    settings = get_settings()
    classifier = OllamaClassifier(settings.ollama_base_url, settings.ollama_model)
    cases = load_corpus()

    correct = 0
    false_blocks: list[str] = []
    misses: list[str] = []

    for case in cases:
        finding = await classifier.classify_prompt(case["text"])
        actual = finding[0] if finding else "public"
        if actual == case["category"]:
            correct += 1
        else:
            misses.append(f"{case['id']}: expected {case['category']}, got {actual}")
        if case["category"] == "public" and actual != "public":
            false_blocks.append(case["id"])

    accuracy = correct / len(cases)
    print(f"\nClassifier eval: {correct}/{len(cases)} correct ({accuracy:.0%}) "
          f"against {settings.ollama_model} @ {settings.ollama_base_url}")
    for m in misses:
        print(f"  MISS {m}")

    # Hard bar (PRD "Eval corpus design"): zero false blocks on the clean subset. A false
    # positive here is an unrecoverable block on innocuous text at Tier 0, with no
    # maskable span to offer a redaction path.
    assert false_blocks == [], f"clean-subset false blocks: {false_blocks}"
