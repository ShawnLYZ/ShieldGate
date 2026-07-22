export interface BannerOpts {
  suspended?: boolean;
  fallbackLabel?: string | null;
  degraded?: boolean;
  policyVersion?: number | null;
}

export function renderBanner(root: ShadowRoot, toolLabel: string, tier: number, opts?: BannerOpts) {
  let b = root.querySelector<HTMLDivElement>(".sg-banner");
  if (!b) { b = document.createElement("div"); b.className = "sg-banner"; b.setAttribute("data-testid", "sg-banner"); root.appendChild(b); }
  b.classList.remove("t0", "t1", "t2"); b.classList.add(`t${tier}`);
  // continuity-suspended tools are enforced as Tier 0 by content.ts regardless of
  // their real DB tier; surface that here (plus the fallback tool, if any) so the
  // badge doesn't silently disagree with the enforcement the user is hitting.
  const suspendedBadge = opts?.suspended
    ? `<span data-testid="sg-suspended">⛔ Suspended${opts.fallbackLabel ? ` · Try ${opts.fallbackLabel} instead` : ""}</span>`
    : "";
  b.innerHTML = `<span>🛡️ ShieldGate active</span>
    <span data-testid="sg-tier-badge">${toolLabel} · Tier ${tier}</span>${suspendedBadge}`;
  if (opts?.degraded) markDegraded(root, opts.policyVersion ?? null);
}

/** §8: the badge discloses degraded mode + which cached policy version is being
 * enforced. Also called after load when a backend call first fails. */
export function markDegraded(root: ShadowRoot, policyVersion: number | null) {
  const b = root.querySelector<HTMLDivElement>(".sg-banner");
  if (!b || b.querySelector('[data-testid="sg-degraded"]')) return;
  const chip = document.createElement("span");
  chip.setAttribute("data-testid", "sg-degraded");
  chip.textContent = `⚠ degraded${policyVersion != null ? ` · cached v${policyVersion}` : " · no cached policy"}`;
  b.appendChild(chip);
}
