import { describe, expect, it } from "vitest";
import { looksDocumentShaped } from "./doc-shape";

describe("looksDocumentShaped", () => {
  it("treats long text as document-shaped", () => {
    expect(looksDocumentShaped("x".repeat(200))).toBe(true);
  });

  it("treats multi-line structured text as document-shaped", () => {
    expect(looksDocumentShaped("notes\n- a\n- b\n- c")).toBe(true);
  });

  it("treats a short one-liner as not document-shaped", () => {
    expect(looksDocumentShaped("hi there friend")).toBe(false);
  });
});
