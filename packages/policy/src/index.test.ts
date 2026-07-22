import { describe, expect, it } from "vitest";
import {
  CATEGORY_SEVERITY, PATTERN_DEFS,
  zApprovalStatus, zClassifyResponse, zPolicySnapshot,
} from "./index";

describe("policy package", () => {
  it("orders category severity restricted > confidential > internal > public", () => {
    expect(CATEGORY_SEVERITY.restricted).toBeGreaterThan(CATEGORY_SEVERITY.confidential);
    expect(CATEGORY_SEVERITY.confidential).toBeGreaterThan(CATEGORY_SEVERITY.internal);
    expect(CATEGORY_SEVERITY.internal).toBeGreaterThan(CATEGORY_SEVERITY.public);
  });

  it("parses a valid snapshot", () => {
    const snap = zPolicySnapshot.parse({
      version: 1,
      generated_at: "2026-07-16T00:00:00Z",
      matrix: [{ data_category: "restricted", tier: 0, action: "block" }],
      tools: [{ id: "x", name: "Mock AI Chat", domains: ["localhost:5175"], tier: 0,
                capability_tags: ["chat"], continuity_status: "active", fallback_tool_id: null }],
    });
    expect(snap.matrix[0].action).toBe("block");
  });

  it("rejects a classify response with unknown action", () => {
    expect(() => zClassifyResponse.parse({
      category: "public", action: "nuke", matches: [], maskable: false,
      reason_plain: "", coaching: { show: false }, suggestion: null,
      policy_version: 1, degraded: false,
    })).toThrow();
  });

  it("approval statuses cover the workflow FSM (design §4 package contents)", () => {
    expect(zApprovalStatus.options).toEqual([
      "submitted", "triaged", "under_review", "info_requested",
      "approved", "rejected", "auto_rejected",
    ]);
    expect(() => zApprovalStatus.parse("escalated")).toThrow();
  });

  it("ships pattern defs with compilable regex sources", () => {
    expect(PATTERN_DEFS.length).toBeGreaterThanOrEqual(6);
    for (const p of PATTERN_DEFS) expect(() => new RegExp(p.source, p.flags)).not.toThrow();
  });
});
