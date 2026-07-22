import re

# Hardcoded, non-configurable ethical floor. No admin setting can loosen this.
_SIGNATURES: list[tuple[str, re.Pattern]] = [
    ("covert or undisclosed employee monitoring",
     re.compile(r"(?i)\b(covert|covertly|secret|secretly|undisclosed|hidden|without (their |them )?(knowledge|disclosure|consent))\b"
                r".{0,40}\b(monitor|track|surveil|keystroke|keylog|watch|record)\b"
                r"|\b(monitor|track|surveil|keylog)\b.{0,40}\b(covert|covertly|secret|without (their |them )?(knowledge|consent))\b")),
    ("undisclosed profiling of individuals",
     re.compile(r"(?i)\bprofile\b.{0,40}\b(without|secret|undisclosed|covert)\b"
                r"|\b(without|secret|undisclosed)\b.{0,20}\bprofil")),
    ("social scoring of individuals",
     re.compile(r"(?i)\bsocial (credit|scoring)\b")),
    ("biometric identification without consent",
     re.compile(r"(?i)\bbiometric\b.{0,40}\b(without consent|no consent|covert|secret)\b")),
]


def prohibited_check(name: str, purpose: str) -> str | None:
    blob = f"{name} {purpose}"
    for reason, rx in _SIGNATURES:
        if rx.search(blob):
            return reason
    return None
