import type { PolicySnapshot } from "@shieldgate/policy";
import {
  classify, classifyResponse, fetchSnapshot, redactConfirm, registerProvenance, requestAccess, sendEvents,
} from "../src/client";
import { type Cached, loadSnapshotResilient, noteObservedVersion, type SnapshotStore } from "../src/snapshot-cache";
import { enqueue, type EventStore, flush, type QueueableEvent, stampDegraded } from "../src/event-queue";

// chrome.storage.local-backed stores for the injected cache/queue logic.
const SNAP_KEY = "__snapshot_cache";
const QUEUE_KEY = "__event_queue";

const snapshotStore: SnapshotStore<PolicySnapshot> = {
  async get() {
    const got = await chrome.storage.local.get<{ [SNAP_KEY]?: Cached<PolicySnapshot> }>([SNAP_KEY]);
    return got[SNAP_KEY] ?? null;
  },
  async set(value) {
    await chrome.storage.local.set({ [SNAP_KEY]: value });
  },
};

const eventStore: EventStore = {
  async get() {
    const got = await chrome.storage.local.get<{ [QUEUE_KEY]?: unknown[] }>([QUEUE_KEY]);
    return got[QUEUE_KEY] ?? [];
  },
  async set(events) {
    await chrome.storage.local.set({ [QUEUE_KEY]: events });
  },
};

// Opportunistically drain any events queued while offline. Best effort.
function tryFlush() {
  flush(eventStore, sendEvents).catch(() => {/* still offline — keep the queue */});
}

// Popup-visible degraded flag (§8): flipped false on any successful backend
// round-trip, true when one fails. Best-effort — display state, not policy state.
function noteBackendState(ok: boolean) {
  chrome.storage.local.set({ __degraded: !ok }).catch?.(() => {});
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        if (msg.type === "classify") {
          const data = await classify(msg.payload);
          noteBackendState(true);
          // Version-triggered refresh: if the backend reports a newer policy version than
          // the cached snapshot, refresh it in the background (non-blocking).
          if (typeof data.policy_version === "number") {
            noteObservedVersion(snapshotStore, data.policy_version, fetchSnapshot).catch(() => {});
          }
          tryFlush(); // a successful round-trip is a reconnect moment — drain the queue
          sendResponse({ ok: true, data });
        } else if (msg.type === "snapshot") {
          // Cache-first with stale fallback: when the backend is unreachable, the
          // cached snapshot (even past TTL) keeps being enforced, flagged degraded.
          const res = await loadSnapshotResilient(snapshotStore, fetchSnapshot);
          noteBackendState(!res.degraded);
          if (!res.degraded) tryFlush(); // page load is a good moment to drain the queue
          sendResponse({ ok: true, data: res });
        } else if (msg.type === "events") {
          try {
            await sendEvents(msg.payload);
            noteBackendState(true);
            tryFlush();
          } catch {
            // Backend unreachable — persist for retry instead of dropping, stamped
            // degraded with the client-side timestamp (Important #1: offline blocks
            // must reach the audit trail once connectivity returns).
            const nowIso = new Date().toISOString();
            for (const e of msg.payload as QueueableEvent[]) {
              await enqueue(eventStore, stampDegraded(e, nowIso));
            }
            noteBackendState(false);
          }
          sendResponse({ ok: true });
        } else if (msg.type === "redact") {
          sendResponse({ ok: true, data: await redactConfirm(msg.payload.text, msg.payload.tool_domain) });
        } else if (msg.type === "request-access") {
          sendResponse({ ok: true, data: await requestAccess(msg.payload.tool_name, msg.payload.tool_url, msg.payload.purpose) });
        } else if (msg.type === "provenance") {
          sendResponse({ ok: true, data: await registerProvenance(msg.payload.text, msg.payload.tool_domain) });
        } else if (msg.type === "classify-response") {
          sendResponse({ ok: true, data: await classifyResponse(msg.payload.text, msg.payload.tool_domain) });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async response
  });
});
