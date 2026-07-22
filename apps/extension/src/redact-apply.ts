import type { LocalMatch } from "./local-scan";

export function applyMasks(text: string, matches: LocalMatch[]): string {
  let out = text;
  for (const m of [...matches].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, m.start) + m.masked + out.slice(m.end);
  }
  return out;
}
