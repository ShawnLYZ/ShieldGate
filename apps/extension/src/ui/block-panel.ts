import type { ClassifyResponse } from "@shieldgate/policy";
import { attachBeam, beamMarkup } from "./beam";
import {
  ICON_BAN,
  ICON_ALERT,
  ICON_CHECK,
  ICON_CLIPBOARD,
  ICON_ERASER,
  ICON_INFO,
  ICON_KEY,
  ICON_PENCIL,
  ICON_SEND,
} from "./icons";
import { noticeStack } from "./notice-stack";
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

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** One line under the title saying what happens next, so the heading can stay short. */
function subtitle(result: ClassifyResponse): string {
  if (result.action === "warn") {
    return "You can send this, but the send is recorded against your pseudonym.";
  }
  return result.maskable
    ? "The detected values can be masked and the rest of your prompt sent as-is."
    : "This prompt cannot be sent to this tool.";
}

export function showBlockPanel(
  root: ShadowRoot, text: string, result: ClassifyResponse, cb: PanelCallbacks,
) {
  root.querySelector(".sg-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "sg-overlay";
  const { canRedact, canProceedAnyway, title } = panelButtons(result);
  const blocked = result.action === "block";
  const tone = blocked ? "block" : "warn";

  overlay.innerHTML = `
    <div class="sg-panel sg-verdict-${tone}" data-testid="sg-block-panel" role="dialog" aria-modal="true"
         aria-labelledby="sg-title" tabindex="-1">
      ${beamMarkup(tone)}
      <div class="sg-panel-scroll">
        <div class="sg-panel-head">
          <span class="sg-panel-mark">${blocked ? ICON_BAN : ICON_ALERT}</span>
          <div>
            <h2 id="sg-title">${title}</h2>
            <p class="sg-panel-sub">${escapeHtml(subtitle(result))}</p>
          </div>
        </div>
        <div class="sg-panel-body sg-stack">
          <p class="sg-reason" data-testid="sg-reason">${escapeHtml(result.reason_plain)}</p>
          ${result.coaching.show ? `<div class="sg-note sg-coaching" data-testid="sg-coaching">${ICON_INFO}<span>
            First time seeing this? ShieldGate checks prompts locally before they leave your browser,
            so sensitive data doesn't reach an unapproved AI tool. Redact and continue, or request access to the tool.</span></div>` : ""}
          <div>
            <p class="sg-label">What was detected in your prompt</p>
            <div class="sg-diff" data-testid="sg-diff">${renderDiff(text, result.matches)}</div>
          </div>
          ${result.suggestion ? `<div class="sg-note sg-suggestion" data-testid="sg-suggestion">${ICON_CHECK}<span>Try <b>${escapeHtml(result.suggestion.name)}</b> instead</span></div>` : ""}
        </div>
        <div class="sg-actions">
          ${canRedact ? `<button class="sg-btn" data-testid="sg-send-redacted">${ICON_ERASER}Send redacted version</button>` : ""}
          ${canProceedAnyway ? `<button class="sg-btn sg-btn-danger" data-testid="sg-send-anyway">${ICON_SEND}Send anyway (logged)</button>` : ""}
          <button class="sg-btn sg-btn-neutral" data-testid="sg-edit">${ICON_PENCIL}Edit prompt</button>
          <button class="sg-btn sg-btn-neutral sg-actions-spacer" data-testid="sg-request-access">${ICON_KEY}Request access</button>
        </div>
      </div>
    </div>`;
  root.appendChild(overlay);

  const panel = overlay.querySelector<HTMLElement>(".sg-panel")!;
  const detachBeam = attachBeam(panel, result.matches.length + 1);

  // One teardown for every exit path, so the rAF loop and the key listener can
  // never outlive the panel.
  const close = () => {
    detachBeam();
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };

  function onKey(e: KeyboardEvent) {
    // Escape leaves the prompt exactly where it is, in the composer, unsent —
    // which is what "Edit prompt" does. It is never a way to bypass the block.
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      cb.onEdit();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    // Focus stays inside the panel: tabbing out and hitting the site's own Send
    // button while a block is on screen would defeat the whole thing.
    const active = root.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", onKey, true);

  // The panel itself takes focus rather than the first button: a destructive
  // "Send anyway" must not start out under the Enter key.
  panel.focus();

  const on = (testid: string, fn: () => void) =>
    overlay.querySelector(`[data-testid="${testid}"]`)?.addEventListener("click", () => {
      close();
      fn();
    });

  on("sg-send-redacted", () => cb.onSendRedacted());
  on("sg-send-anyway", () => cb.onProceedAnyway?.());
  on("sg-edit", () => cb.onEdit());
  on("sg-request-access", () => cb.onRequestAccess());
}

export function renderRequestConfirmation(root: ShadowRoot, res: unknown) {
  // Scoped to this toast's own testid, not `.sg-toast`: the provenance-copy
  // toast shares the class, and a request confirmation must not silently
  // swallow the disclosure that something was just written to the clipboard.
  root.querySelector('[data-testid="sg-request-confirm"]')?.remove();
  const sla = (res as { sla_due_at?: unknown } | null)?.sla_due_at ?? "unknown";
  const toast = document.createElement("div");
  toast.className = "sg-toast";
  toast.setAttribute("data-testid", "sg-request-confirm");
  toast.setAttribute("role", "status");
  toast.innerHTML =
    `${ICON_CLIPBOARD}<span>Request submitted` +
    `<span class="sg-toast-ref"> · SLA ${escapeHtml(String(sla))}</span></span>`;
  noticeStack(root).appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}
