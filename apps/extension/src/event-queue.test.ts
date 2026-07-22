import { describe, expect, it, vi } from "vitest";
import { enqueue, type EventStore, flush, stampDegraded } from "./event-queue";

function fakeStore(initial: unknown[] = []): EventStore {
  let value = initial;
  return {
    get: async () => value,
    set: async (v) => { value = v; },
  };
}

describe("event-queue", () => {
  it("enqueue appends an event to the persisted queue", async () => {
    const store = fakeStore([{ a: 1 }]);
    await enqueue(store, { b: 2 });
    expect(await store.get()).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("flush sends all queued events plus a degraded_flush marker, then clears", async () => {
    // The marker rides in the same batch (spec §2 event list / §6 events group):
    // the audit trail records that a degraded backlog was uploaded, atomically
    // with the backlog itself.
    const store = fakeStore([{ a: 1 }, { b: 2 }]);
    const send = vi.fn(async () => {});
    await flush(store, send);
    expect(send).toHaveBeenCalledWith([
      { a: 1 }, { b: 2 },
      { event_type: "degraded_flush", direction: "system",
        masked_excerpt: "flushed 2 queued event(s)" },
    ]);
    expect(await store.get()).toEqual([]);
  });

  it("stampDegraded marks the event degraded and stamps occurred_at when absent", () => {
    const stamped = stampDegraded(
      { event_type: "block", direction: "prompt" }, "2026-07-20T10:00:00Z");
    expect(stamped.degraded).toBe(true);
    expect(stamped.occurred_at).toBe("2026-07-20T10:00:00Z");
  });

  it("stampDegraded preserves an existing occurred_at (client already stamped it)", () => {
    const stamped = stampDegraded(
      { event_type: "block", direction: "prompt", occurred_at: "2026-07-20T09:00:00Z" },
      "2026-07-20T10:00:00Z");
    expect(stamped.occurred_at).toBe("2026-07-20T09:00:00Z");
    expect(stamped.degraded).toBe(true);
  });

  it("flush keeps the queue intact when the send fails", async () => {
    const store = fakeStore([{ a: 1 }]);
    const send = vi.fn(async () => { throw new Error("offline"); });
    await expect(flush(store, send)).rejects.toThrow("offline");
    expect(await store.get()).toEqual([{ a: 1 }]);
  });

  it("flush does not call send when the queue is empty", async () => {
    const store = fakeStore([]);
    const send = vi.fn(async () => {});
    await flush(store, send);
    expect(send).not.toHaveBeenCalled();
  });
});
