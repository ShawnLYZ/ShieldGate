"""Deterministic pattern layer. Regex sources mirror packages/policy/src/patterns.ts."""
import re
from dataclasses import dataclass

_DEFS: list[tuple[str, str, str, bool]] = [
    # (type, regex, plain-language label, needs_luhn)
    ("card", r"\b(?:\d[ -]?){13,19}\b", "a payment card number", True),
    ("my_ic", r"\b\d{6}-\d{2}-\d{4}\b", "a Malaysian IC number", False),
    ("passport", r"\b[A-Z]{1,2}\d{7,8}\b", "a passport number", False),
    ("api_key",
     r"(sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}"
     r"|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"
     r"|-----BEGIN [A-Z ]*PRIVATE KEY-----)",
     "an API key or credential", False),
    ("email", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "an email address", False),
    ("phone", r"(?:\+?6?01\d[-\s]?\d{3}[-\s]?\d{4}|\+\d{9,14})", "a phone number", False),
]
_COMPILED = [(t, re.compile(rx), label, luhn) for t, rx, label, luhn in _DEFS]


@dataclass(frozen=True)
class PatternMatch:
    type: str
    start: int
    end: int
    masked: str
    label: str


def luhn_ok(digits: str) -> bool:
    if not digits.isdigit() or len(digits) < 13:
        return False
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def _mask(kind: str, raw: str) -> str:
    if kind == "card":
        digits = [c for c in raw if c.isdigit()]
        keep_head, keep_tail = 4, 4
        seen = 0
        out = []
        for c in raw:
            if c.isdigit():
                seen += 1
                out.append(c if seen <= keep_head or seen > len(digits) - keep_tail else "*")
            else:
                out.append(c)
        return "".join(out)
    if kind == "email":
        local, _, domain = raw.partition("@")
        return f"{local[0]}***@{domain}"
    if kind == "api_key":
        return raw[:4] + "…" + raw[-2:] if len(raw) > 8 else "****"
    # my_ic, passport, phone: keep last 4
    return "*" * max(len(raw) - 4, 0) + raw[-4:]


def scan(text: str) -> list[PatternMatch]:
    found: list[PatternMatch] = []
    taken: list[tuple[int, int]] = []
    for kind, rx, label, needs_luhn in _COMPILED:
        for m in rx.finditer(text):
            raw = m.group(0)
            # Strip trailing separators from card numbers (regex may match trailing space)
            if kind == "card":
                trimmed = raw.rstrip(" -")
                span = (m.start(), m.start() + len(trimmed))
                raw = trimmed
            else:
                span = (m.start(), m.end())
            if needs_luhn and not luhn_ok("".join(c for c in raw if c.isdigit())):
                continue
            if any(s < span[1] and span[0] < e for s, e in taken):
                continue  # overlap with a higher-priority match
            taken.append(span)
            found.append(PatternMatch(kind, span[0], span[1], _mask(kind, raw), label))
    return sorted(found, key=lambda x: x.start)


def mask_text(text: str, matches: list[PatternMatch]) -> str:
    out = text
    for m in sorted(matches, key=lambda x: x.start, reverse=True):
        out = out[: m.start] + m.masked + out[m.end :]
    return out
