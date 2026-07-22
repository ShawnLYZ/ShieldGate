// Degraded-mode event queue. When the backend is unreachable, usage/consent events are
// persisted to chrome.storage.local instead of being dropped, and flushed on the next
// successful round-trip. Storage + sender are injected so the logic is unit-testable.

export interface EventStore {
  get(): Promise<unknown[]>;
  set(events: unknown[]): Promise<void>;
}

export interface QueueableEvent {
  event_type: string;
  direction: string;
  degraded?: boolean;
  occurred_at?: string | null;
  [k: string]: unknown;
}

/**
 * Mark an event as produced under degraded conditions and pin its client-side
 * timestamp. Queued events are delivered later, so without occurred_at the audit
 * chain would record flush time as event time; an already-stamped occurred_at
 * (the content script saw the failure first-hand) is preserved.
 */
export function stampDegraded<T extends QueueableEvent>(
  event: T, nowIso: string,
): T & { degraded: true; occurred_at: string } {
  return { ...event, degraded: true, occurred_at: event.occurred_at ?? nowIso };
}

/** Append an event to the persisted queue. */
export async function enqueue(store: EventStore, event: unknown): Promise<void> {
  const queued = await store.get();
  await store.set([...queued, event]);
}

/**
 * Send everything queued — plus a degraded_flush marker in the same batch, so the
 * audit trail records that a degraded backlog was uploaded (spec §2 event list) —
 * then clear it. The queue is cleared ONLY after a successful send, so a failure
 * leaves the events intact for the next flush. No-op on an empty queue.
 */
export async function flush(
  store: EventStore,
  send: (events: unknown[]) => Promise<void>,
): Promise<void> {
  const queued = await store.get();
  if (queued.length === 0) return;
  await send([...queued, {
    event_type: "degraded_flush", direction: "system",
    masked_excerpt: `flushed ${queued.length} queued event(s)`,
  }]);
  await store.set([]);
}
