import csv
import io
from dataclasses import dataclass
from datetime import date, datetime

KNOWN_AI_DOMAINS = {
    "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "perplexity.ai",
    "midjourney.com", "gemini.google.com", "mistral.ai", "cohere.com", "huggingface.co",
    "character.ai", "stability.ai", "copilot.microsoft.com",
}


@dataclass
class Candidate:
    domain: str
    first_seen: date
    last_seen: date
    user_count: int


def parse_idp_csv(text: str, known_domains: set[str] | None = None) -> list[Candidate]:
    known = known_domains or set()
    reader = csv.DictReader(io.StringIO(text))
    agg: dict[str, dict] = {}
    for row in reader:
        domain = (row.get("domain") or "").strip().lower()
        if not domain or domain not in KNOWN_AI_DOMAINS or domain in known:
            continue
        ts = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")).date()
        user = (row.get("user_email") or "").strip().lower()
        a = agg.setdefault(domain, {"first": ts, "last": ts, "users": set()})
        a["first"] = min(a["first"], ts)
        a["last"] = max(a["last"], ts)
        if user:
            a["users"].add(user)
    return [Candidate(d, v["first"], v["last"], len(v["users"])) for d, v in agg.items()]
