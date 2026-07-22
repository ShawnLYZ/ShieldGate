import type { SiteAdapter, ToolDescriptor } from "./types";

export const mockAdapter: SiteAdapter = {
  id: "mock",
  matches(host) {
    return host === "localhost:5175" || host === "127.0.0.1:5175"
      ? ({ domain: host, label: "Mock AI Chat" } satisfies ToolDescriptor) : null;
  },
  getComposer() { return document.querySelector<HTMLTextAreaElement>('[data-testid="composer"]'); },
  getComposerText() { return (this.getComposer() as HTMLTextAreaElement)?.value ?? ""; },
  setComposerText(t) { const c = this.getComposer() as HTMLTextAreaElement; if (c) c.value = t; },
  onBeforeSend(handler) {
    const form = document.getElementById("composer-form") as HTMLFormElement;
    let bypass = false;
    form?.addEventListener("submit", (e) => {
      if (bypass) { bypass = false; return; }
      const text = this.getComposerText().trim();
      if (!text) return;
      e.preventDefault(); e.stopImmediatePropagation();
      handler(text,
        () => { bypass = true; form.requestSubmit(); },
        () => {});
    }, { capture: true });
  },
  watchResponses(cb) {
    const target = document.getElementById("messages");
    if (!target) return;
    new MutationObserver((muts) => {
      for (const mut of muts) for (const n of mut.addedNodes) {
        if (n instanceof HTMLElement && n.matches('[data-testid="message-assistant"]'))
          cb(n.textContent ?? "", n);
      }
    }).observe(target, { childList: true });
  },
  onCopy(handler) {
    document.getElementById("messages")?.addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      if (el.matches('[data-testid="copy-btn"]')) {
        // Own the copy fully: stop the site's native click handler (which would
        // otherwise write plain, un-footered text to the clipboard) before
        // handing off to the extension's handler.
        e.preventDefault(); e.stopImmediatePropagation();
        const text = el.closest('[data-testid="message-assistant"]')?.querySelector("pre")?.textContent ?? "";
        handler(text);
      }
    }, { capture: true });
  },
};
