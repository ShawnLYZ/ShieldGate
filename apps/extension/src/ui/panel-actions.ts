import type { ClassifyResponse } from "@shieldgate/policy";

/**
 * Which actions the block/warn panel should offer for a verdict.
 * - block + maskable -> "Send redacted version"
 * - warn -> "Send anyway (logged)" (the two warn matrix cells are warn+log, not a dead-end block)
 */
export function panelButtons(result: Pick<ClassifyResponse, "action" | "maskable">) {
  return {
    canRedact: result.action === "block" && result.maskable,
    canProceedAnyway: result.action === "warn",
    title: result.action === "block" ? "Blocked by ShieldGate" : "Heads up",
  };
}
