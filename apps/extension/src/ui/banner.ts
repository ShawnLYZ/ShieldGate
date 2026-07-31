import { ICON_BAN, ICON_PLUG_OFF, ICON_SHIELD } from "./icons";

export interface BannerOpts {
  suspended?: boolean;
  fallbackLabel?: string | null;
  degraded?: boolean;
  policyVersion?: number | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

/** Tier drives the rail colour and the badge tone. The badge still spells the
 *  tier out, so colour is reinforcement rather than the only carrier. */
const TIER_CHIP: Record<number, string> = {
  0: "sg-chip-block",
  1: "sg-chip-warn",
  2: "sg-chip-allow",
};

export function renderBanner(root: ShadowRoot, toolLabel: string, tier: number, opts?: BannerOpts) {
  let b = root.querySelector<HTMLDivElement>(".sg-banner");
  if (!b) {
    b = document.createElement("div");
    b.className = "sg-banner";
    b.setAttribute("data-testid", "sg-banner");
    // Announced politely: it is ambient status, not something to interrupt for.
    b.setAttribute("role", "status");
    root.appendChild(b);
  }
  b.classList.remove("t0", "t1", "t2"); b.classList.add(`t${tier}`);
  // continuity-suspended tools are enforced as Tier 0 by content.ts regardless of
  // their real DB tier; surface that here (plus the fallback tool, if any) so the
  // badge doesn't silently disagree with the enforcement the user is hitting.
  const suspendedBadge = opts?.suspended
    ? `<span class="sg-chip sg-chip-block" data-testid="sg-suspended">${ICON_BAN}Suspended${
        opts.fallbackLabel ? ` · Try ${escapeHtml(opts.fallbackLabel)} instead` : ""
      }</span>`
    : "";
  b.innerHTML =
    `<span class="sg-banner-brand">${ICON_SHIELD}ShieldGate active</span>` +
    `<span class="sg-chip ${TIER_CHIP[tier] ?? ""}" data-testid="sg-tier-badge">` +
    `${escapeHtml(toolLabel)} · Tier ${tier}</span>${suspendedBadge}`;
  if (opts?.degraded) markDegraded(root, opts.policyVersion ?? null);
}

/** §8: the badge discloses degraded mode + which cached policy version is being
 * enforced. Also called after load when a backend call first fails. */
export function markDegraded(root: ShadowRoot, policyVersion: number | null) {
  const b = root.querySelector<HTMLDivElement>(".sg-banner");
  if (!b || b.querySelector('[data-testid="sg-degraded"]')) return;
  const chip = document.createElement("span");
  // Pushed to the far end of the strip so it reads as a system condition rather
  // than as another property of the tool badge next to it.
  chip.className = "sg-chip sg-chip-warn sg-banner-spacer";
  chip.setAttribute("data-testid", "sg-degraded");
  chip.innerHTML = `${ICON_PLUG_OFF}degraded${
    policyVersion != null ? ` · cached v${policyVersion}` : " · no cached policy"
  }`;
  b.appendChild(chip);
}
