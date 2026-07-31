"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";
import { useChartTheme } from "@/lib/chart-theme";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { ErrorNote, Loading } from "@/components/ui/page";

// Incident count per day: a single sequential series (change over time, one measure).
// One line, no legend — the panel title already names the one thing plotted.
// The hue comes from lib/chart-theme's `solo` slot, which is the same validated
// slot-1 blue in light mode (#2a78d6) and its dark-surface re-derivation in dark
// mode, so every chart in the app still reads as one system in either theme.
export function IncidentsTrend() {
  const [trend, setTrend] = useState<{ date: string; incidents: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chart = useChartTheme();

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/reports/executive")
      .then((d) => { if (active) setTrend((d as { risk_trend: { date: string; incidents: number }[] }).risk_trend); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load trend"); });
    return () => { active = false; };
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!trend) return <Loading className="px-0" />;
  if (trend.length === 0) {
    return <div className="px-0 py-6 text-sm text-[var(--sg-muted)]">No incidents yet.</div>;
  }

  return (
    <div data-testid="incidents-trend" style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: chart.axis, fontSize: 11 }}
            axisLine={{ stroke: chart.grid }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: chart.axis, fontSize: 11 }}
            axisLine={false} tickLine={false} width={32} />
          <Tooltip
            content={<ChartTooltip unit="incidents" />}
            cursor={{ stroke: chart.grid }}
          />
          {/* 2px line, no dots per point (marks-and-anatomy.md line spec);
              dot only on hover via activeDot. */}
          <Line type="monotone" dataKey="incidents" stroke={chart.solo} strokeWidth={2}
            dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
