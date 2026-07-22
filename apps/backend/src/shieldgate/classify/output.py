import re
from dataclasses import dataclass

_CRED = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)(secret|password|api[_-]?key)\s*[:=]\s*\S{8,}"),
]
_EXPLOIT = [
    re.compile(r"curl\s+https?://\S+\s*\|\s*(sh|bash)"),
    re.compile(r"(?i)base64\.b64decode\("),
    re.compile(r"CVE-\d{4}-\d{4,7}"),
    re.compile(r"(?i)(union\s+select|or\s+1=1|sqlmap)"),
]
_BIAS = [
    re.compile(r"(?i)\b(because|due to)\b.{0,40}\b(race|gender|religion|age|nationality|ethnicity)\b"),
]


@dataclass(frozen=True)
class OutputFlag:
    type: str
    masked: str
    label: str


def _mask(s: str) -> str:
    s = s.strip()
    return (s[:6] + "…" + s[-2:]) if len(s) > 10 else "****"


def scan_output(text: str) -> list[OutputFlag]:
    flags: list[OutputFlag] = []
    for rx in _CRED:
        m = rx.search(text)
        if m:
            flags.append(OutputFlag("credential", _mask(m.group(0)), "a credential-like string"))
            break
    for rx in _EXPLOIT:
        m = rx.search(text)
        if m:
            flags.append(OutputFlag("exploit_code", _mask(m.group(0)), "exploit-shaped code"))
            break
    for rx in _BIAS:
        m = rx.search(text)
        if m:
            flags.append(OutputFlag("bias_language", _mask(m.group(0)),
                                    "language correlated with a protected attribute"))
            break
    return flags
