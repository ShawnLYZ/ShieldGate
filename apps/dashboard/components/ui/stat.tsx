import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

/* Stat-tile contract (dataviz skill, "Figures"): label above, one value below,
   in the default proportional figures. `tabular-nums` is deliberately NOT set
   here — it is for columns of numbers that must align, and it makes a single
   large headline figure look mechanically spaced. */

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  footer,
  className,
  ...props
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "block" | "warn" | "allow";
  footer?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const accent = {
    default: "var(--sg-accent)",
    block: "var(--sg-block)",
    warn: "var(--sg-warn)",
    allow: "var(--sg-allow)",
  }[tone];

  return (
    <Card className={cn("overflow-hidden p-4", className)} {...props}>
      {/* 2px inset rail — the only place tone shows up, so the tile never
          becomes a big block of colour competing with the figure. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-[2px] rounded-r"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--sg-muted)]">
            {label}
          </div>
          <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[var(--sg-fg)]">
            {value}
          </div>
          {hint ? <div className="mt-1.5 text-xs text-[var(--sg-muted)]">{hint}</div> : null}
        </div>
        {icon ? (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--sg-surface-2)]"
            style={{ color: accent }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Card>
  );
}
