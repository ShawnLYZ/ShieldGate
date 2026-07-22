import type { SiteAdapter, ToolDescriptor } from "./types";

/**
 * Shared factory for the real-site adapters (ChatGPT / Claude / Gemini).
 *
 * IMPORTANT: the selectors passed in by each site config are BEST-EFFORT and UNVERIFIED
 * against the live sites — they cannot be exercised in this repo's test environment (there
 * is no live DOM to drive). They will drift as the sites change. Every selector lookup is
 * null-guarded so a miss degrades to a no-op (the user keeps their normal send/copy) rather
 * than throwing. The mock-site adapter (mock.ts) remains the tested reference implementation.
 */
export interface SiteConfig {
  id: string;
  label: string;
  hosts: string[];
  /** composer element selectors, first match wins */
  composer: string[];
  /** send-button selectors used by `release`, first match wins */
  sendButton: string[];
  /** selector identifying an assistant message node (for response scanning + copy) */
  assistantMessage: string;
  /** optional copy-button selector for click delegation */
  copyButton?: string;
  /** optional selector, within a message, of the text to copy (defaults to the message text) */
  copySource?: string;
}

function firstMatch(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

export function makeSiteAdapter(cfg: SiteConfig): SiteAdapter {
  const composer = () => firstMatch(cfg.composer);

  return {
    id: cfg.id,
    matches(host) {
      return cfg.hosts.includes(host)
        ? ({ domain: host, label: cfg.label } satisfies ToolDescriptor)
        : null;
    },
    getComposer: composer,
    getComposerText() {
      return composer()?.textContent ?? "";
    },
    setComposerText(t) {
      const c = composer();
      if (c) c.textContent = t;
    },
    onBeforeSend(handler) {
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        const text = (composer()?.textContent ?? "").trim();
        if (!text) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        handler(
          text,
          // release: click the site's send button. If the selector has drifted the click
          // is a no-op and the user simply presses Enter again — never a thrown error.
          () => { firstMatch(cfg.sendButton)?.click(); },
          () => {},
        );
      }, { capture: true });
    },
    watchResponses(cb) {
      try {
        new MutationObserver((muts) => {
          for (const mut of muts) {
            for (const n of mut.addedNodes) {
              if (!(n instanceof HTMLElement)) continue;
              const msg = n.matches(cfg.assistantMessage)
                ? n
                : n.querySelector<HTMLElement>(cfg.assistantMessage);
              if (msg) cb(msg.textContent ?? "", msg);
            }
          }
        }).observe(document.body, { childList: true, subtree: true });
      } catch {
        /* unexpected DOM — skip response scanning rather than break the page */
      }
    },
    onCopy(handler) {
      if (!cfg.copyButton) return;
      document.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest<HTMLElement>(cfg.copyButton!);
        if (!btn) return;
        // Own the copy so the site's native handler doesn't write un-footered text first.
        e.preventDefault();
        e.stopImmediatePropagation();
        const container = btn.closest<HTMLElement>(cfg.assistantMessage);
        const src = cfg.copySource ? container?.querySelector<HTMLElement>(cfg.copySource) : container;
        handler(src?.textContent ?? container?.textContent ?? "");
      }, { capture: true });
    },
  };
}
