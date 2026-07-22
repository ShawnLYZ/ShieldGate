// Policy-snapshot cache (design §3/§8). The content script no longer hits the backend
// on every page load: a snapshot is cached in chrome.storage.local and refreshed only
// when it is older than the TTL, or when a newer policy version is observed on a
// classify response. Storage + fetcher are injected so the logic is unit-testable
// without chrome globals.

export const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface Cached<T> {
  snapshot: T;
  fetchedAt: number;
}

export interface SnapshotStore<T> {
  get(): Promise<Cached<T> | null>;
  set(value: Cached<T>): Promise<void>;
}

/** Cache-first load: returns the cached snapshot while fresh, otherwise fetches + caches. */
export async function loadSnapshot<T>(
  store: SnapshotStore<T>,
  fetcher: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const cached = await store.get();
  if (cached && now() - cached.fetchedAt < SNAPSHOT_TTL_MS) {
    return cached.snapshot;
  }
  const fresh = await fetcher();
  await store.set({ snapshot: fresh, fetchedAt: now() });
  return fresh;
}

/**
 * Degraded-aware load (§8): when the backend is unreachable, fall back to the
 * cached snapshot even past its TTL — enforcing a stale matrix beats reporting no
 * matrix (which would silently demote every tool to Tier 0 and misreport the
 * banner). `degraded: true` tells the UI to disclose the state.
 */
export async function loadSnapshotResilient<T>(
  store: SnapshotStore<T>,
  fetcher: () => Promise<T>,
  now: () => number = Date.now,
): Promise<{ snapshot: T | null; degraded: boolean }> {
  try {
    return { snapshot: await loadSnapshot(store, fetcher, now), degraded: false };
  } catch {
    const cached = await store.get();
    return { snapshot: cached?.snapshot ?? null, degraded: true };
  }
}

/**
 * Version-triggered refresh: the content script passes the policy_version it sees on a
 * classify response. If it differs from the cached snapshot's version, the cache is stale
 * regardless of age, so refetch. Otherwise the cached snapshot is returned untouched.
 */
export async function noteObservedVersion<T extends { version: number }>(
  store: SnapshotStore<T>,
  observedVersion: number,
  fetcher: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const cached = await store.get();
  if (!cached || cached.snapshot.version !== observedVersion) {
    const fresh = await fetcher();
    await store.set({ snapshot: fresh, fetchedAt: now() });
    return fresh;
  }
  return cached.snapshot;
}
