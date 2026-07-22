import { describe, expect, it } from "vitest";
import { localScan } from "./local-scan";

describe("localScan", () => {
  it("detects a Luhn-valid card and masks it", () => {
    const ms = localScan("charge 4532-0151-1283-0366 now");
    const card = ms.find((m) => m.type === "card")!;
    expect(card.masked).toBe("4532-****-****-0366");
  });
  it("ignores a Luhn-invalid number", () => {
    expect(localScan("id 4532-0151-1283-0361").some((m) => m.type === "card")).toBe(false);
  });
  it("detects api keys and emails", () => {
    expect(localScan("sk-abcdEFGH1234567890xyz").some((m) => m.type === "api_key")).toBe(true);
    expect(localScan("a@b.co").some((m) => m.type === "email")).toBe(true);
  });
  it("returns nothing for clean text", () => {
    expect(localScan("draft an agenda")).toEqual([]);
  });
});
