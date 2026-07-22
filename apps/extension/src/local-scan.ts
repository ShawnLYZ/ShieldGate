import { PATTERN_DEFS } from "@shieldgate/policy";

export interface LocalMatch { type: string; start: number; end: number; masked: string; label: string; }

function luhnOk(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length < 13) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

function mask(type: string, raw: string): string {
  if (type === "card") {
    const digits = raw.replace(/\D/g, "");
    let seen = 0;
    return [...raw].map((c) => {
      if (!/\d/.test(c)) return c;
      seen++;
      return seen <= 4 || seen > digits.length - 4 ? c : "*";
    }).join("");
  }
  if (type === "email") { const [l, d] = raw.split("@"); return `${l[0]}***@${d}`; }
  if (type === "api_key") return raw.length > 8 ? `${raw.slice(0, 4)}…${raw.slice(-2)}` : "****";
  return "*".repeat(Math.max(raw.length - 4, 0)) + raw.slice(-4);
}

export function localScan(text: string): LocalMatch[] {
  const out: LocalMatch[] = [];
  const taken: [number, number][] = [];
  for (const def of PATTERN_DEFS) {
    const rx = new RegExp(def.source, def.flags.includes("g") ? def.flags : def.flags + "g");
    for (let m = rx.exec(text); m; m = rx.exec(text)) {
      let raw = m[0];
      let span: [number, number] = [m.index, m.index + raw.length];
      // Card regex can greedily consume a trailing space/dash after the last
      // digit when followed by more text; trim it before masking/spanning
      // (mirrors the fix in apps/backend/src/shieldgate/classify/patterns.py).
      if (def.type === "card") {
        const trimmed = raw.replace(/[ -]+$/, "");
        span = [m.index, m.index + trimmed.length];
        raw = trimmed;
      }
      if (def.validator === "luhn" && !luhnOk(raw)) continue;
      if (taken.some(([s, e]) => s < span[1] && span[0] < e)) continue;
      taken.push(span);
      out.push({ type: def.type, start: span[0], end: span[1], masked: mask(def.type, raw), label: def.label });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
