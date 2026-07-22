import { pickAdapter } from "../src/adapters";
import { looksDocumentShaped } from "../src/doc-shape";
import { buildFooteredText, pendingFooter } from "../src/footer";
import { localScan } from "../src/local-scan";
import { applyMasks } from "../src/redact-apply";
import { markDegraded, renderBanner } from "../src/ui/banner";
import { renderRequestConfirmation, showBlockPanel } from "../src/ui/block-panel";
import type { PanelCallbacks } from "../src/ui/block-panel";
import { showPendingIndicator, withPendingIndicator } from "../src/ui/pending";
import { showRibbon } from "../src/ui/ribbon";
import { PANEL_CSS } from "../src/ui/styles";
import { showToast } from "../src/ui/toast";
import type { ClassifyResponse, MatrixAction, PolicySnapshot } from "@shieldgate/policy";

export default defineContentScript({
  matches: ["http://localhost:5175/*", "http://127.0.0.1:5175/*",
            "https://chatgpt.com/*", "https://chat.openai.com/*",
            "https://claude.ai/*", "https://gemini.google.com/*"],
  runAt: "document_idle",
  async main() {
    const host = location.host;
    const adapter = pickAdapter(host);
    if (!adapter) return;
    const descriptor = adapter.matches(host)!;

    const container = document.createElement("div");
    document.documentElement.appendChild(container);
    const root = container.attachShadow({ mode: "open" });
    const style = document.createElement("style"); style.textContent = PANEL_CSS; root.appendChild(style);

    // The background falls back to the cached snapshot (even past TTL) when the
    // backend is unreachable, flagging degraded — §8: enforce the cached matrix,
    // never silently demote to "no policy".
    const snapRes = await send<{ snapshot: PolicySnapshot | null; degraded: boolean }>(
      { type: "snapshot" }).catch(() => ({ snapshot: null, degraded: true }));
    const snap = snapRes.snapshot;
    const tool = snap?.tools.find((t) => t.domains.includes(host));
    const tier = tool?.tier ?? 0;
    // A tool can be continuity-suspended (admin toggle) while its DB tier stays
    // 1/2. The backend is the enforcer: its classify/redact decisions map a
    // suspended tool to effective Tier 0 (see policy.engine.effective_tier). The
    // extension mirrors that here as defense-in-depth and to drive the suspended
    // ribbon + fallback-tool UI — treat a suspended tool as Tier 0 for both the
    // fast-path bypass below and the post-classify verdict.
    const suspended = tool?.continuity_status === "suspended";
    const enforcedTier = suspended ? 0 : tier;
    const fallbackTool = suspended && tool?.fallback_tool_id
      ? (snap?.tools.find((t) => t.id === tool.fallback_tool_id) ?? null)
      : null;
    renderBanner(root, descriptor.label, enforcedTier, {
      ...(suspended ? { suspended: true, fallbackLabel: fallbackTool?.name ?? null } : {}),
      degraded: snapRes.degraded, policyVersion: snap?.version ?? null,
    });

    // Fire-and-forget audit emission for locally-decided (degraded) moments; the
    // background queues it if the events endpoint is down too (Important #1).
    function emitDegradedEvent(event_type: string, extra: Record<string, unknown>) {
      send({ type: "events", payload: [{
        event_type, direction: "prompt", tool_domain: host,
        degraded: true, occurred_at: new Date().toISOString(), ...extra,
      }] }).catch(() => {});
    }

    // Re-judge a classify verdict against the Tier 0 row of the snapshot matrix.
    // Only used when `suspended`, since a real Tier 0 tool's own classify result
    // already reflects tier 0 policy.
    function tier0Action(category: ClassifyResponse["category"]): MatrixAction {
      return snap?.matrix.find((m) => m.data_category === category && m.tier === 0)?.action ?? "block";
    }

    adapter.onBeforeSend(async (text, release) => {
      const local = localScan(text);
      // Public/clean text on this tool: fast-allow and fire a usage ping — UNLESS the
      // text is document-shaped, in which case it escalates to the backend so the
      // context classifier can flag ambiguous confidential content (story 12). A suspended
      // tool has enforcedTier 0, so (like a real Tier 0 tool) it always falls through to
      // a full classify below instead of fast-allowing.
      if (local.length === 0 && enforcedTier > 0 && !looksDocumentShaped(text)) {
        send({ type: "events", payload: [{ event_type: "allow_usage", direction: "prompt",
          tool_domain: host, data_category: "public", matrix_action: "allow" }] });
        // Release on a fresh task, never inline. This is the ONE path that can
        // reach release() synchronously inside the site's own submit dispatch,
        // and per the HTML spec a form that is still "firing submission events"
        // silently ignores a nested requestSubmit() — the prompt would be eaten
        // and the user would have to press Send twice on every approved tool.
        // Every other path awaits a backend call first, so it already resumes on
        // a later task. setTimeout(0) adds no perceptible latency and keeps the
        // allow path network-free (design §5 latency budget).
        setTimeout(release, 0); return;
      }
      // Predicts the backend's own escalation gate (routes/classify.is_document_shaped)
      // so the indicator's "local AI model" copy is only shown when a call is actually
      // likely to reach it, not on every fast DB-only round trip.
      const willEscalate = local.length === 0 && looksDocumentShaped(text);
      let result: ClassifyResponse;
      try {
        result = await withPendingIndicator(
          () => showPendingIndicator(root),
          willEscalate,
          () => send<ClassifyResponse>({ type: "classify", payload: {
            direction: "prompt", text, tool_domain: host, client_matches: local.map((m) => m.type),
            policy_version: snap?.version ?? null } }),
        );
      } catch {
        // Degraded: enforce locally against the cached policy. Any local hit
        // blocks (fail-safe never means fail-open), and the locally-enforced
        // outcome is audited rather than vanishing (Important #1).
        markDegraded(root, snap?.version ?? null);
        if (local.length) { showLocalBlock(release); return; }
        emitDegradedEvent("allow_usage", {});
        release(); return;
      }
      if (suspended && result.category !== "public") {
        result = { ...result, action: tier0Action(result.category),
          reason_plain: `${descriptor.label} is suspended. ${result.reason_plain}` };
      }
      if (result.action === "allow") { release(); return; }

      // Recursive so re-showing the panel after a still-block/warn residual
      // (Send redacted did not fully clear it) keeps live buttons instead of
      // silently releasing or leaving the user with dead callbacks.
      const callbacksFor = (currentText: string): PanelCallbacks => ({
        onSendRedacted: async () => {
          const residual = applyMasks(currentText, localScan(currentText));
          let verdict: ClassifyResponse;
          try {
            verdict = await send<ClassifyResponse>({ type: "redact",
              payload: { text: residual, tool_domain: host } });
          } catch {
            // Backend died between classify and the redact click. Fail-safe: never
            // release the ORIGINAL text here — inject the locally-redacted residual
            // only when the regex layer confirms it clean, and audit the consent.
            if (localScan(residual).length) { showLocalBlock(release); } else {
              emitDegradedEvent("redacted_send",
                { masked_excerpt: "[redacted send: degraded local check]" });
              markDegraded(root, snap?.version ?? null);
              adapter!.setComposerText(residual);
              release();
            }
            return;
          }
          if (suspended && verdict.category !== "public") {
            verdict = { ...verdict, action: tier0Action(verdict.category) };
          }
          if (verdict.action === "allow") { adapter!.setComposerText(residual); release(); }
          else { showBlockPanel(root, residual, verdict, callbacksFor(residual)); }
        },
        onEdit: () => {},
        onProceedAnyway: () => {
          // warn cells are warn+log: let the user proceed but record the consented send.
          send({ type: "events", payload: [{ event_type: "allow_usage", direction: "prompt",
            tool_domain: host, data_category: result.category, matrix_action: "warn" }] });
          adapter!.setComposerText(currentText);
          release();
        },
        onRequestAccess: async () => {
          try {
            const res = await send({ type: "request-access", payload: {
              tool_name: descriptor.label, tool_url: `https://${host}`,
              purpose: "requested from block panel" } });
            renderRequestConfirmation(root, res);
          } catch { /* best effort: no confirmation on failure */ }
        },
      });
      showBlockPanel(root, text, result, callbacksFor(text));
    });

    adapter.watchResponses(async (text, node) => {
      try {
        const res = await send<ClassifyResponse>({ type: "classify-response", payload: {
          direction: "response", text, tool_domain: host, client_matches: [], policy_version: snap?.version ?? null } });
        if (res.action === "warn" && res.matches[0]) showRibbon(node, res.matches[0].masked ? res.matches[0].type : "sensitive content");
      } catch { /* best effort: a scan failure shouldn't disrupt the page */ }
    });
    adapter.onCopy?.(async (text) => {
      // Hard invariant: nothing is added to the clipboard without a toast. If
      // /provenance is unreachable, still give the user their copy (plain) but
      // disclose it, rather than silently leaving an untracked clipboard write
      // with no toast.
      try {
        const { public_ref, footer } = await send<{ public_ref: string; footer: string }>({
          type: "provenance", payload: { text, tool_domain: host } });
        await navigator.clipboard.writeText(buildFooteredText(text, footer));
        showToast(root, `Provenance footer added (${public_ref}).`);
        // §2/§6: provenance toasts are audit events too ("provenance_copy").
        send({ type: "events", payload: [{ event_type: "provenance_copy", direction: "system",
          tool_domain: host, masked_excerpt: public_ref }] }).catch(() => {});
      } catch {
        // Offline: still stamp a footer with a pending id rather than leaving the copy
        // untracked, so the clipboard write is never silently unprovenanced.
        await navigator.clipboard.writeText(buildFooteredText(text, pendingFooter(descriptor.label)));
        showToast(root, "Copied with a pending provenance id (offline).");
        emitDegradedEvent("provenance_copy", { direction: "system", masked_excerpt: "pending-id" });
      }
    });

    function showLocalBlock(release: () => void) {
      const text = adapter!.getComposerText();
      const matches = localScan(text);
      // A locally-enforced block is a governance event like any other: audit it.
      // masked_excerpt masks the detected spans, mirroring the backend's excerpts.
      emitDegradedEvent("block", {
        data_category: "restricted", matrix_action: "block",
        pattern_types: matches.map((m) => m.type),
        masked_excerpt: applyMasks(text, matches).slice(0, 160),
      });
      markDegraded(root, snap?.version ?? null);
      showBlockPanel(root, text,
        { category: "restricted", action: "block",
          matches: matches.map((m) => ({ type: m.type, span: [m.start, m.end], masked: m.masked })),
          maskable: true, reason_plain: "ShieldGate is offline; blocking sensitive data locally.",
          coaching: { show: false }, suggestion: null, policy_version: snap?.version ?? 0, degraded: true },
        {
          // Degraded "Send redacted": no backend re-check is possible, so inject the
          // residual only when the local regex layer confirms it clean; otherwise
          // re-show the panel. The original text is never released from here.
          onSendRedacted: () => {
            const current = adapter!.getComposerText();
            const residual = applyMasks(current, localScan(current));
            if (localScan(residual).length === 0) {
              emitDegradedEvent("redacted_send",
                { masked_excerpt: "[redacted send: degraded local check]" });
              adapter!.setComposerText(residual);
              release();
            } else {
              showLocalBlock(release);
            }
          },
          onEdit: () => {},
          onRequestAccess: async () => {
            try {
              const res = await send({ type: "request-access", payload: {
                tool_name: descriptor.label, tool_url: `https://${host}`,
                purpose: "requested from block panel" } });
              renderRequestConfirmation(root, res);
            } catch { /* offline: request-access needs the backend */ }
          },
        });
    }
  },
});

function send<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (!resp?.ok) reject(new Error(resp?.error ?? "no response"));
      else resolve(resp.data as T);
    });
  });
}
