"use client";

import * as React from "react";

/* One tooltip for every chart in the app.

   Rules it encodes (dataviz skill, interaction.md): the VALUE leads — bold and
   high-contrast — and the category follows in muted ink; a multi-series tooltip
   carries a colour swatch per row so the mapping to the marks is explicit
   rather than remembered. It renders on the themed surface tokens, so it stays
   legible when the console flips to light mode.

   Recharts passes `payload` with a loose shape that differs between chart
   types; the props below cover the three shapes this app actually renders. */

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  fill?: string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  /** Appended after a single-series value, e.g. "incidents". */
  unit?: string;
  /** Pulls the caption from the datum instead of the axis label. */
  labelKey?: string;
  /** Formats each value (currency, percentages, …). */
  format?: (n: number) => string;
}

const shell =
  "rounded-[var(--sg-radius-sm)] border border-[var(--sg-border-strong)] bg-[var(--sg-surface)] px-2.5 py-1.5 text-xs shadow-[var(--sg-shadow)]";

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelKey,
  format = (n: number) => n.toLocaleString(),
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const multi = payload.length > 1;
  const caption =
    labelKey && payload[0]?.payload
      ? String(payload[0].payload[labelKey] ?? "")
      : label != null
        ? String(label)
        : "";

  if (!multi) {
    const p = payload[0];
    return (
      <div className={shell}>
        <div className="font-semibold text-[var(--sg-fg)]">
          {format(p.value ?? 0)}
          {unit ? <span className="ml-1 font-normal text-[var(--sg-fg-secondary)]">{unit}</span> : null}
        </div>
        {caption ? <div className="text-[var(--sg-muted)]">{caption}</div> : null}
      </div>
    );
  }

  return (
    <div className={shell}>
      {caption ? <div className="mb-1 text-[var(--sg-muted)]">{caption}</div> : null}
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-sm"
              style={{ background: p.fill ?? p.color }}
            />
            <span className="font-semibold text-[var(--sg-fg)]">{format(p.value ?? 0)}</span>
            <span className="text-[var(--sg-muted)]">{String(p.dataKey ?? p.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
