"use client";
import { useEffect, useState } from "react";
import { authedGet } from "@/lib/api";

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
    <div data-testid="cost-counter" className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <span>Cost avoidance</span>
        {data && (
          <details className="relative inline-block">
            <summary className="cursor-pointer list-none text-gray-400" aria-label="Formula and assumptions">
              (?)
            </summary>
            <div className="absolute left-0 top-5 z-10 w-64 rounded border bg-white p-2 text-xs text-gray-700 shadow-lg">
              <div className="mb-1 font-medium">Formula</div>
              <div className="mb-2">{data.formula}</div>
              <div className="mb-1 font-medium">Assumptions</div>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(data.assumptions, null, 2)}</pre>
            </div>
          </details>
        )}
      </div>
      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="text-3xl font-semibold">{data ? formatCurrency(data.total) : "…"}</div>
      )}
    </div>
  );
}
