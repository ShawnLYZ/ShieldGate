import { describe, expect, it } from "vitest";
import { panelButtons } from "./panel-actions";

describe("panelButtons", () => {
  it("offers 'send anyway' on a warn verdict, not redact", () => {
    const b = panelButtons({ action: "warn", maskable: true });
    expect(b.canProceedAnyway).toBe(true);
    expect(b.canRedact).toBe(false);
    expect(b.title).toBe("Heads up");
  });

  it("offers redact on a maskable block, not 'send anyway'", () => {
    const b = panelButtons({ action: "block", maskable: true });
    expect(b.canRedact).toBe(true);
    expect(b.canProceedAnyway).toBe(false);
    expect(b.title).toBe("Blocked by ShieldGate");
  });

  it("offers neither on a non-maskable block", () => {
    const b = panelButtons({ action: "block", maskable: false });
    expect(b.canRedact).toBe(false);
    expect(b.canProceedAnyway).toBe(false);
  });
});
