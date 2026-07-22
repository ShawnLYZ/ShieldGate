import { describe, expect, it } from "vitest";
import { pickAdapter } from "./index";

describe("pickAdapter host matching", () => {
  it.each([
    ["localhost:5175", "mock"],
    ["127.0.0.1:5175", "mock"],
    ["chatgpt.com", "chatgpt"],
    ["chat.openai.com", "chatgpt"],
    ["claude.ai", "claude"],
    ["gemini.google.com", "gemini"],
  ])("routes %s to the %s adapter", (host, id) => {
    expect(pickAdapter(host)?.id).toBe(id);
  });

  it("returns null for an unrelated host", () => {
    expect(pickAdapter("example.com")).toBeNull();
  });

  it("exposes a matching ToolDescriptor label", () => {
    expect(pickAdapter("claude.ai")?.matches("claude.ai")?.label).toBe("Claude");
    expect(pickAdapter("chatgpt.com")?.matches("chatgpt.com")?.label).toBe("ChatGPT");
  });
});
