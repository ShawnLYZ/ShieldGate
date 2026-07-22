import { makeSiteAdapter } from "./site-factory";

// Best-effort, UNVERIFIED selectors (see site-factory.ts) — Gemini DOM drift is expected.
// Gemini's composer is a Quill-based rich-textarea (.ql-editor inside <rich-textarea>).
export const geminiAdapter = makeSiteAdapter({
  id: "gemini",
  label: "Gemini",
  hosts: ["gemini.google.com"],
  composer: ["rich-textarea .ql-editor", ".ql-editor"],
  sendButton: ['button[aria-label="Send message"]', "button.send-button"],
  assistantMessage: "message-content, .model-response-text",
  copyButton: 'button[aria-label="Copy"], button[data-test-id="copy-button"]',
});
