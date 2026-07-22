"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";
import type { IncidentRow } from "@/lib/types";

// dataviz skill (choosing-a-form.md): "Compare magnitude, low -> high | bar/column
// | sequential (one hue)" -- same job as usage-by-department.tsx (one measure,
// event count, across a nominal category), just two categories worth grouping
// by (tool, department), so this reuses that component's exact treatment
// rather than inventing a second chart language: same validated slot-1 blue
// (#2a78d6, node scripts/validate_palette.js "#2a78d6" --mode light -> PASS),
// same single-hue-no-legend rule (one series per chart, the title names it),
// same table-view twin per chart.
const BAR_COLOR = "#2a78d6";
const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";
const SURFACE = "#fcfcfb";

interface Count { key: string; count: number }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Count }> }) {
  if (!active || !payload?.length) return null;
  const { key, count } = payload[0].payload;
  return (
    <div className="rounded border px-2 py-1 text-xs shadow" style={{ background: SURFACE }}>
      <div className="font-semibold">{count.toLocaleString()}</div>
      <div className="text-gray-500">{key}</div>
    </div>
  );
}

function GroupedBar({ title, data, showTable, onToggle }: {
  title: string; data: Count[]; showTable: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">{title}</h2>
        <button onClick={onToggle} className="text-xs text-gray-500 underline">
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500">No flagged output events.</div>
      ) : showTable ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th>{title}</th><th>Flags</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t"><td className="py-1">{d.key}</td><td>{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="key" tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: SURFACE, opacity: 0.6 }} />
            <Bar dataKey="count" fill={BAR_COLOR} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function groupBy(rows: IncidentRow[], key: "tool_domain" | "department"): Count[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = r[key] ?? "Unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function OutputRiskChart() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToolTable, setShowToolTable] = useState(false);
  const [showDeptTable, setShowDeptTable] = useState(false);

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/audit?event_type=output_flag")
      .then((body) => { if (active) setRows((body.items as IncidentRow[]) ?? []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const byTool = useMemo(() => groupBy(rows, "tool_domain"), [rows]);
  const byDept = useMemo(() => groupBy(rows, "department"), [rows]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!loaded) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div data-testid="output-risk-panel" className="grid gap-6 md:grid-cols-2">
      <GroupedBar title="By tool" data={byTool} showTable={showToolTable} onToggle={() => setShowToolTable((s) => !s)} />
      <GroupedBar title="By department" data={byDept} showTable={showDeptTable} onToggle={() => setShowDeptTable((s) => !s)} />
    </div>
  );
}
