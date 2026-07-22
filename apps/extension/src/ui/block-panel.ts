import type { ClassifyResponse } from "@shieldgate/policy";
import { panelButtons } from "./panel-actions";

export interface PanelCallbacks {
  onSendRedacted: () => void;
  onEdit: () => void;
  onRequestAccess: () => void;
  onProceedAnyway?: () => void;
}

function renderDiff(text: string, matches: ClassifyResponse["matches"]): string {
  if (!matches.length) return escapeHtml(text.slice(0, 400));
  let out = "", cursor = 0;
  for (const m of [...matches].sort((a, b) => a.span[0] - b.span[0])) {
    out += escapeHtml(text.slice(cursor, m.span[0]));
    out += `<mark>${escapeHtml(m.masked)}</mark>`;
    cursor = m.span[1];
  }
  out += escapeHtml(text.slice(cursor));
  return out;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

export function showBlockPanel(
  root: ShadowRoot, text: string, result: ClassifyResponse, cb: PanelCallbacks,
) {
  root.querySelector(".sg-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "sg-overlay";
  const { canRedact, canProceedAnyway, title } = panelButtons(result);
  overlay.innerHTML = `
    <div class="sg-panel" data-testid="sg-block-panel" role="dialog" aria-modal="true">
      <h2>${title}</h2>
      <p data-testid="sg-reason">${escapeHtml(result.reason_plain)}</p>
      ${result.coaching.show ? `<div class="sg-coaching" data-testid="sg-coaching">
        First time seeing this? ShieldGate checks prompts locally before they leave your browser,
        so sensitive data doesn't reach an unapproved AI tool. Redact and continue, or request access to the tool.</div>` : ""}
      <div class="sg-diff" data-testid="sg-diff">${renderDiff(text, result.matches)}</div>
      ${result.suggestion ? `<p class="sg-suggestion" data-testid="sg-suggestion">Try ${escapeHtml(result.suggestion.name)} instead</p>` : ""}
      <div class="sg-actions">
        ${canRedact ? `<button class="sg-primary" data-testid="sg-send-redacted">Send redacted version</button>` : ""}
        ${canProceedAnyway ? `<button class="sg-primary" data-testid="sg-send-anyway">Send anyway (logged)</button>` : ""}
        <button data-testid="sg-edit">Edit prompt</button>
        <button data-testid="sg-request-access">Request access</button>
      </div>
    </div>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-testid="sg-send-redacted"]')?.addEventListener("click", () => { overlay.remove(); cb.onSendRedacted(); });
  overlay.querySelector('[data-testid="sg-send-anyway"]')?.addEventListener("click", () => { overlay.remove(); cb.onProceedAnyway?.(); });
  overlay.querySelector('[data-testid="sg-edit"]')?.addEventListener("click", () => { overlay.remove(); cb.onEdit(); });
  overlay.querySelector('[data-testid="sg-request-access"]')?.addEventListener("click", () => { overlay.remove(); cb.onRequestAccess(); });
}

export function renderRequestConfirmation(root: ShadowRoot, res: unknown) {
  root.querySelector(".sg-toast")?.remove();
  const sla = (res as any)?.sla_due_at ?? "unknown";
  const toast = document.createElement("div");
  toast.className = "sg-toast";
  toast.innerHTML = `<div class="sg-toast-body" data-testid="sg-request-confirm">Request submitted · SLA ${escapeHtml(String(sla))}</div>`;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}
