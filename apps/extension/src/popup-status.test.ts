import { describe, expect, it } from "vitest";
import type { Cached } from "./snapshot-cache";
import { syncSummary } from "./popup-status";

const snap = (version: number, tools: number) =>
  ({ version, tools: Array.from({ length: tools }, (_, i) => ({ id: String(i) })), matrix: [] }) as never;

describe("syncSummary", () => {
  it("reports not-synced when there is no cache", () => {
    const s = syncSummary(null, 0, 1000);
    expect(s.synced).toBe(false);
    expect(s.line).toBe("Not synced yet");
  });

  it("summarises version, tool count and sync age", () => {
    const cached = { snapshot: snap(4, 3), fetchedAt: 0 } as Cached<never>;
    const s = syncSummary(cached, 0, 5 * 60000);
    expect(s.synced).toBe(true);
    expect(s.line).toContain("v4");
    expect(s.line).toContain("3 tools");
    expect(s.line).toContain("5m ago");
  });

  it("shows the pending offline queue length", () => {
    const cached = { snapshot: snap(4, 3), fetchedAt: 0 } as Cached<never>;
    const s = syncSummary(cached, 2, 60000);
    expect(s.line).toContain("2 event(s) queued");
  });

  it("flags degraded mode alongside the cached policy version (§8 popup mirror)", () => {
    const cached = { snapshot: snap(4, 3), fetchedAt: 0 } as Cached<never>;
    const s = syncSummary(cached, 1, 60000, true);
    expect(s.line).toContain("DEGRADED");
    expect(s.line).toContain("v4");
  });

  it("reports unreachable-with-no-cache as its own degraded state", () => {
    const s = syncSummary(null, 0, 1000, true);
    expect(s.synced).toBe(false);
    expect(s.line).toBe("Backend unreachable — no cached policy");
  });
});
