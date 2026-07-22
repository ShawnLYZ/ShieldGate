import type { PolicySnapshot } from "@shieldgate/policy";
import type { Cached } from "./snapshot-cache";

/** One-line sync summary for the popup, derived from the cached snapshot + offline queue.
 * `degraded` mirrors the backend-unreachable state per §8 ("popup mirrors state:
 * policy version, degraded indicator"). */
export function syncSummary(
  cached: Cached<PolicySnapshot> | null,
  queueLength: number,
  now: number,
  degraded = false,
): { synced: boolean; line: string } {
  if (!cached) {
    return { synced: false, line: degraded ? "Backend unreachable — no cached policy" : "Not synced yet" };
  }
  const ageMin = Math.max(0, Math.floor((now - cached.fetchedAt) / 60000));
  const pending = queueLength > 0 ? ` · ${queueLength} event(s) queued` : "";
  const state = degraded ? " · DEGRADED (cached policy)" : "";
  return {
    synced: true,
    line: `v${cached.snapshot.version} · ${cached.snapshot.tools.length} tools · synced ${ageMin}m ago${state}${pending}`,
  };
}
