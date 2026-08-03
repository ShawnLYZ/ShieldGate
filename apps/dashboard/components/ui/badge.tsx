import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, BanIcon, CheckCircleIcon, InfoIcon } from "./icons";

/* Anti-pattern this exists to prevent: "color-only indicators". Every badge
   below carries a word, and the three verdict badges additionally carry a
   distinct glyph — so a red/green-blind reviewer, a greyscale print of the
   executive report, and a screen reader all get the same answer. */

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--sg-border-strong)] bg-[var(--sg-surface-2)] text-[var(--sg-fg-secondary)]",
        accent:
          "border-[color-mix(in_srgb,var(--sg-accent)_40%,transparent)] bg-[var(--sg-accent-soft)] text-[var(--sg-accent-text)]",
        block:
          "border-[color-mix(in_srgb,var(--sg-block)_42%,transparent)] bg-[var(--sg-block-soft)] text-[var(--sg-block-text)]",
        warn: "border-[color-mix(in_srgb,var(--sg-warn)_42%,transparent)] bg-[var(--sg-warn-soft)] text-[var(--sg-warn-text)]",
        allow:
          "border-[color-mix(in_srgb,var(--sg-allow)_42%,transparent)] bg-[var(--sg-allow-soft)] text-[var(--sg-allow-text)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** allow / warn / block — the vocabulary shared with the extension. */
export function VerdictBadge({ action, className }: { action: string | null; className?: string }) {
  const map: Record<string, { tone: BadgeTone; Icon: typeof BanIcon; label: string }> = {
    block: { tone: "block", Icon: BanIcon, label: "block" },
    warn: { tone: "warn", Icon: AlertTriangleIcon, label: "warn" },
    allow: { tone: "allow", Icon: CheckCircleIcon, label: "allow" },
  };
  const hit = action ? map[action] : undefined;
  if (!hit) {
    return (
      <Badge tone="neutral" className={className}>
        <InfoIcon size={11} />
        {action ?? "—"}
      </Badge>
    );
  }
  return (
    <Badge tone={hit.tone} className={className}>
      <hit.Icon size={11} />
      {hit.label}
    </Badge>
  );
}

const TIER_META: Record<number, { tone: BadgeTone; label: string }> = {
  0: { tone: "block", label: "Tier 0 · unapproved" },
  1: { tone: "warn", label: "Tier 1 · restricted" },
  2: { tone: "allow", label: "Tier 2 · enterprise" },
};

export function TierBadge({
  tier,
  short = false,
  className,
}: {
  tier: number | null | undefined;
  short?: boolean;
  className?: string;
}) {
  if (tier == null) return <Badge className={className}>unregistered</Badge>;
  const meta = TIER_META[tier] ?? { tone: "neutral" as BadgeTone, label: `Tier ${tier}` };
  return (
    <Badge tone={meta.tone} className={className}>
      {short ? `Tier ${tier}` : meta.label}
    </Badge>
  );
}

/** Approval-request lifecycle + continuity states, one place. */
const STATUS_TONE: Record<string, BadgeTone> = {
  submitted: "neutral",
  triaged: "accent",
  under_review: "accent",
  info_requested: "warn",
  approved: "allow",
  rejected: "block",
  auto_rejected: "block",
  open: "warn",
  in_review: "accent",
  resolved: "allow",
  new: "accent",
  reviewed: "allow",
  dismissed: "neutral",
  promoted: "allow",
  active: "allow",
  advisory: "warn",
  suspended: "block",
  on_track: "allow",
  at_risk: "warn",
  breached: "block",
};

/* The visible label is humanized (`under_review` -> "under review"), so it is prose and
   free to change. `data-status` carries the raw wire value so system tests can assert the
   lifecycle state itself rather than the wording chosen to render it. */
export function StatusBadge({
  status,
  className,
  ...props
}: { status: string } & Omit<BadgeProps, "tone" | "children">) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className={className} {...props} data-status={status}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
