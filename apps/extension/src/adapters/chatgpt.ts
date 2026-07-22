import { makeSiteAdapter } from "./site-factory";

// Best-effort, UNVERIFIED selectors (see site-factory.ts) — ChatGPT DOM drift is expected.
// Excluded from CI; the mock adapter is the tested reference.
export const chatgptAdapter = makeSiteAdapter({
  id: "chatgpt",
  label: "ChatGPT",
  hosts: ["chatgpt.com", "chat.openai.com"],
  composer: ["#prompt-textarea", 'div[contenteditable="true"]'],
  sendButton: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]'],
  assistantMessage: '[data-message-author-role="assistant"]',
  copyButton: 'button[data-testid="copy-turn-action-button"]',
});
