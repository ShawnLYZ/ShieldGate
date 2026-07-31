"use client";
import { useEffect, useState } from "react";
import { authedGet } from "@/lib/api";
import { CoinsIcon, InfoIcon } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/stat";

interface CostAvoidance {
  total: number;
  per_category: Record<string, number>;
  formula: string;
  assumptions: Record<string, unknown>;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Stat-tile contract (dataviz skill, marks-and-anatomy.md "Figures"): label +
// value in the default proportional figures (never tabular-nums on a large
// standalone number -- that's reserved for table/axis columns). A single
// current value with no trend is exactly the "stat tile, not a chart" case
// from choosing-a-form.md.
//
// The disclosure is a native <details> rather than a hover tooltip on purpose:
// a derived money figure has to be auditable on a touch device and by keyboard,
// and hover is neither.
export function CostCounter() {
  const [data, setData] = useState<CostAvoidance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/reports/cost-avoidance")
      .then((d) => { if (active) setData(d as CostAvoidance); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load"); });
    return () => { active = false; };
  }, []);

  return (
    <StatTile
      data-testid="cost-counter"
      tone="allow"
      icon={<CoinsIcon size={16} />}
      label={
        <>
          <span>Cost avoidance</span>
          {data && (
            <details className="relative inline-block">
              <summary
                className="ml-0.5 inline-flex cursor-pointer list-none items-center text-[var(--sg-faint)] transition-colors hover:text-[var(--sg-fg-secondary)] [&::-webkit-details-marker]:hidden"
                aria-label="Formula and assumptions"
              >
                <InfoIcon size={13} />
              </summary>
              <div className="absolute left-0 top-6 z-20 w-72 rounded-[var(--sg-radius-sm)] border border-[var(--sg-border-strong)] bg-[var(--sg-surface)] p-3 text-xs font-normal text-[var(--sg-fg-secondary)] shadow-[var(--sg-shadow-lg)]">
                <div className="mb-1 font-semibold text-[var(--sg-fg)]">Formula</div>
                <div className="mb-3 leading-relaxed">{data.formula}</div>
                <div className="mb-1 font-semibold text-[var(--sg-fg)]">Assumptions</div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--sg-surface-2)] p-2 font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(data.assumptions, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </>
      }
      value={
        error ? (
          <span className="text-base font-medium text-[var(--sg-block-text)]">{error}</span>
        ) : (
          <span>{data ? formatCurrency(data.total) : "…"}</span>
        )
      }
      hint={data ? "Blocked exposure × modelled incident cost" : undefined}
    />
  );
}
