import { describe, expect, it } from "vitest";
import { buildFooteredText, pendingFooter } from "./footer";

describe("buildFooteredText", () => {
  it("appends the footer exactly once", () => {
    const out = buildFooteredText("hello", "\n\n—\nAI-assisted · Claude · 2026 · PV-2026-000001");
    expect(out.startsWith("hello")).toBe(true);
    expect(out).toContain("PV-2026-000001");
    expect(out.match(/AI-assisted/g)?.length).toBe(1);
  });
});

describe("pendingFooter", () => {
  it("is footer-shaped and carries a pending provenance id", () => {
    const f = pendingFooter("Claude", 2026);
    expect(f).toContain("AI-assisted");
    expect(f).toContain("Claude");
    expect(f).toContain("PV-PENDING");
  });

  it("round-trips through buildFooteredText exactly once", () => {
    const out = buildFooteredText("hi", pendingFooter("Claude", 2026));
    expect(out.startsWith("hi")).toBe(true);
    expect(out.match(/AI-assisted/g)?.length).toBe(1);
  });
});
