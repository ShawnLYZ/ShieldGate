import hashlib
import re

_FOOTER_RE = re.compile(r"\n+—\nAI-assisted · .+? · .+? · PV-\d{4}-\d{6}\s*$", re.DOTALL)


def strip_footer(text: str) -> str:
    return _FOOTER_RE.sub("", text)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()
