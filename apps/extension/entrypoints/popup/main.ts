import type { PolicySnapshot } from "@shieldgate/policy";
import type { Cached } from "../../src/snapshot-cache";
import { syncSummary } from "../../src/popup-status";

export {};

const statusEl = document.getElementById("status")!;
const statusCard = document.getElementById("statusCard")!;
const toolsEl = document.getElementById("tools")!;

/** Tier is the tool's risk band; the chip states the number as text and only
 *  uses colour to reinforce it, same rule as the injected banner. */
const TIER_CHIP: Record<number, string> = {
  0: "sg-chip-block",
  1: "sg-chip-warn",
  2: "sg-chip-allow",
};

(async () => {
  let store: {
    __snapshot_cache?: Cached<PolicySnapshot>;
    __event_queue?: unknown[];
    __degraded?: boolean;
  };
  try {
    store = await chrome.storage.local.get(["__snapshot_cache", "__event_queue", "__degraded"]);
  } catch {
    // Without this the popup sits on "Loading…" forever and looks broken, which
    // is the worst possible failure mode for the one surface whose whole job is
    // telling you whether enforcement is working.
    statusEl.textContent = "Could not read local storage.";
    statusCard.classList.add("is-degraded");
    return;
  }
  const cached = store.__snapshot_cache ?? null;
  const queueLen = store.__event_queue?.length ?? 0;
  const degraded = store.__degraded ?? false;

  statusEl.textContent = syncSummary(cached, queueLen, Date.now(), degraded).line;
  // Degraded is the one popup state worth colouring: it means the policy being
  // enforced right now is a cached copy, not the live one.
  if (degraded) statusCard.classList.add("is-degraded");

  const tools = cached?.snapshot.tools ?? [];
  if (tools.length === 0) {
    const empty = document.createElement("li");
    empty.className = "sg-empty";
    empty.textContent = "No policy snapshot cached yet.";
    toolsEl.appendChild(empty);
    return;
  }

  for (const t of tools) {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "sg-list-name";
    name.textContent = t.name;
    name.title = t.name;

    const tier = document.createElement("span");
    tier.className = `sg-chip ${TIER_CHIP[t.tier] ?? ""}`;
    tier.textContent = `Tier ${t.tier}`;

    li.append(name, tier);

    if (t.continuity_status === "suspended") {
      const susp = document.createElement("span");
      susp.className = "sg-chip sg-chip-block";
      susp.textContent = "suspended";
      li.appendChild(susp);
    }

    toolsEl.appendChild(li);
  }
})();
