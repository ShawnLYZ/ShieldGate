export function buildFooteredText(original: string, footer: string): string {
  return original.endsWith(footer) ? original : original + footer;
}

// When provenance registration is offline, still stamp the copy with a footer carrying a
// PV-PENDING id (instead of leaving it untracked) so it can be reconciled later. Matches
// the backend footer shape: "\n\n—\nAI-assisted · <tool> · <year> · <ref>".
export function pendingFooter(toolLabel: string, year: number = new Date().getFullYear()): string {
  return `\n\n—\nAI-assisted · ${toolLabel} · ${year} · PV-PENDING`;
}
