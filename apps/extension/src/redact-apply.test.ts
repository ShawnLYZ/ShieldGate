import { describe, expect, it } from "vitest";
import { applyMasks } from "./redact-apply";
import { localScan } from "./local-scan";

describe("applyMasks", () => {
  it("replaces detected spans with their masks", () => {
    const text = "charge 4532-0151-1283-0366 now";
    const out = applyMasks(text, localScan(text));
    expect(out).toBe("charge 4532-****-****-0366 now");
    expect(out).not.toContain("4532-0151-1283-0366");
  });
});
