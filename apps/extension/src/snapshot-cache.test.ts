import { describe, expect, it, vi } from "vitest";
import {
  type Cached, loadSnapshot, loadSnapshotResilient, noteObservedVersion,
  SNAPSHOT_TTL_MS, type SnapshotStore,
} from "./snapshot-cache";

type Snap = { version: number };

function fakeStore(initial: Cached<Snap> | null = null): SnapshotStore<Snap> {
  let value = initial;
  return {
    get: async () => value,
    set: async (v) => { value = v; },
  };
}

describe("loadSnapshot", () => {
  it("returns the cached snapshot without fetching when fresh", async () => {
    const store = fakeStore({ snapshot: { version: 3 }, fetchedAt: 1000 });
    const fetcher = vi.fn(async () => ({ version: 9 }));
    const snap = await loadSnapshot(store, fetcher, () => 1000 + SNAPSHOT_TTL_MS - 1);
    expect(snap.version).toBe(3);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches and caches when there is no cache", async () => {
    const store = fakeStore(null);
    const fetcher = vi.fn(async () => ({ version: 7 }));
    const snap = await loadSnapshot(store, fetcher, () => 5000);
    expect(snap.version).toBe(7);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await store.get()).toEqual({ snapshot: { version: 7 }, fetchedAt: 5000 });
  });

  it("refetches when the cache is older than the TTL", async () => {
    const store = fakeStore({ snapshot: { version: 3 }, fetchedAt: 1000 });
    const fetcher = vi.fn(async () => ({ version: 4 }));
    const snap = await loadSnapshot(store, fetcher, () => 1000 + SNAPSHOT_TTL_MS + 1);
    expect(snap.version).toBe(4);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe("loadSnapshotResilient", () => {
  it("passes through a successful load as non-degraded", async () => {
    const store = fakeStore(null);
    const r = await loadSnapshotResilient(store, async () => ({ version: 7 }), () => 5000);
    expect(r).toEqual({ snapshot: { version: 7 }, degraded: false });
  });

  it("falls back to the stale cache and reports degraded when the fetch fails", async () => {
    // §8: backend unreachable → enforce the CACHED snapshot, even past its TTL —
    // a stale matrix beats no matrix (fail-safe, not fail-open or fail-tier-0).
    const store = fakeStore({ snapshot: { version: 3 }, fetchedAt: 1000 });
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    const r = await loadSnapshotResilient(store, fetcher, () => 1000 + SNAPSHOT_TTL_MS + 1);
    expect(r).toEqual({ snapshot: { version: 3 }, degraded: true });
  });

  it("reports degraded with no snapshot when offline and nothing is cached", async () => {
    const store = fakeStore(null);
    const r = await loadSnapshotResilient(store, async () => { throw new Error("offline"); });
    expect(r).toEqual({ snapshot: null, degraded: true });
  });
});

describe("noteObservedVersion", () => {
  it("refetches when an observed version differs from the cached one", async () => {
    const store = fakeStore({ snapshot: { version: 3 }, fetchedAt: 1000 });
    const fetcher = vi.fn(async () => ({ version: 5 }));
    const snap = await noteObservedVersion(store, 5, fetcher, () => 2000);
    expect(snap.version).toBe(5);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not refetch when the observed version matches the cache", async () => {
    const store = fakeStore({ snapshot: { version: 3 }, fetchedAt: 1000 });
    const fetcher = vi.fn(async () => ({ version: 9 }));
    const snap = await noteObservedVersion(store, 3, fetcher, () => 2000);
    expect(snap.version).toBe(3);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
