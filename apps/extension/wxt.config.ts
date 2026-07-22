import { defineConfig } from "wxt";
export default defineConfig({
  manifest: {
    name: "ShieldGate",
    description: "AI-governance guardrails for prompts and responses.",
    permissions: ["storage", "clipboardWrite"],
    host_permissions: [
      "http://127.0.0.1:8000/*", "http://localhost:8000/*",
      "http://localhost:5175/*", "http://127.0.0.1:5175/*",
      "https://chatgpt.com/*", "https://chat.openai.com/*",
      "https://claude.ai/*", "https://gemini.google.com/*",
    ],
  },
});
