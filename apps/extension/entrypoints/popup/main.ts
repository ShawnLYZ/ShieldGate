import type { PolicySnapshot } from "@shieldgate/policy";
import type { Cached } from "../../src/snapshot-cache";
import { syncSummary } from "../../src/popup-status";

export {};

const statusEl = document.getElementById("status")!;
const toolsEl = document.getElementById("tools")!;

(async () => {
  const store = await chrome.storage.local.get<{
    __snapshot_cache?: Cached<PolicySnapshot>;
    __event_queue?: unknown[];
    __degraded?: boolean;
  }>(["__snapshot_cache", "__event_queue", "__degraded"]);
  const cached = store.__snapshot_cache ?? null;
  const queueLen = store.__event_queue?.length ?? 0;
  statusEl.textContent = syncSummary(cached, queueLen, Date.now(), store.__degraded ?? false).line;
  for (const t of cached?.snapshot.tools ?? []) {
    const li = document.createElement("li");
    li.textContent = `${t.name} — Tier ${t.tier}${t.continuity_status === "suspended" ? " (suspended)" : ""}`;
    toolsEl.appendChild(li);
  }
})();
