"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase";
import type { IncidentRow } from "@/lib/types";

// dataviz skill (references/choosing-a-form.md): "Compare magnitude, low ->
// high | bar/column | sequential (one hue)" -- usage-by-department is exactly
// this job: one measure (event count) across a nominal category (department
// has no natural order, so it is NOT ordinal). references/color-formula.md:
// a single nominal series takes the *same* slot-1 hue for every bar, with no
// legend box -- the chart title already names the one thing plotted; coloring
// bars by department identity here would double-encode identity the x-axis
// already shows and burn the categorical channel for nothing.
//
// Slot-1 blue (#2a78d6) validated for this exact role:
//   node scripts/validate_palette.js "#2a78d6" --mode light
//   -> lightness band PASS, chroma floor PASS, contrast-vs-surface (#fcfcfb) PASS
// This app has no dark-mode toggle anywhere (layout.tsx / other components are
// fixed-light), so this chart stays light-only rather than introducing a
// one-off dark variant nothing else in the dashboard supports yet.
const BAR_COLOR = "#2a78d6"; // palette.md categorical slot 1 / sequential default hue
const GRID_COLOR = "#e1e0d9"; // hairline, one step off the #fcfcfb surface
const AXIS_COLOR = "#898781"; // muted ink, axis ticks
const SURFACE = "#fcfcfb";

interface DeptCount { department: string; count: number }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DeptCount }> }) {
  if (!active || !payload?.length) return null;
  const { department, count } = payload[0].payload;
  // Values lead, category follows (interaction.md): the count is the bold,
  // high-contrast line; the department name is secondary.
  return (
    <div className="rounded border px-2 py-1 text-xs shadow" style={{ background: SURFACE }}>
      <div className="font-semibold">{count.toLocaleString()}</div>
      <div className="text-gray-500">{department}</div>
    </div>
  );
}

export function UsageByDepartment() {
  const [rows, setRows] = useState<Pick<IncidentRow, "department">[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let active = true;
    createClient().from("audit_events").select("department").then(({ data }) => {
      if (!active) return;
      setRows((data as Pick<IncidentRow, "department">[] | null) ?? []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const data = useMemo<DeptCount[]>(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const dept = r.department ?? "Unknown";
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Usage by department</h2>
        {/* Every chart has a table-view twin (anti-patterns.md) -- the
            WCAG-clean equivalent for anyone who can't (or doesn't want to)
            read bar length. */}
        <button onClick={() => setShowTable((s) => !s)} className="text-xs text-gray-500 underline">
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-gray-500">No activity visible for this account.</div>
      ) : showTable ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th>Department</th><th>Events</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.department} className="border-t">
                <td className="py-1">{d.department}</td><td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="department" tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false} tickLine={false} width={32} />
            {/* Bar/cell hover tooltip, not a crosshair (interaction.md: bars
                use per-mark hover, the mark itself is the hit target). */}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: SURFACE, opacity: 0.6 }} />
            {/* <=24px thick, 4px rounded top / square at the baseline
                (marks-and-anatomy.md mark spec for bar/column). */}
            <Bar dataKey="count" fill={BAR_COLOR} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
