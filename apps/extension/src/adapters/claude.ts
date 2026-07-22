import { makeSiteAdapter } from "./site-factory";

// Best-effort, UNVERIFIED selectors (see site-factory.ts) — Claude DOM drift is expected.
// Claude's composer is a ProseMirror contenteditable div. Excluded from CI.
export const claudeAdapter = makeSiteAdapter({
  id: "claude",
  label: "Claude",
  hosts: ["claude.ai"],
  composer: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
  sendButton: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
  assistantMessage: '[data-testid="assistant-message"], .font-claude-message',
  copyButton: 'button[data-testid="action-bar-copy"]',
});
