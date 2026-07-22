"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";

interface ExecutiveReportData {
  incidents_avoided: number;
  exposure_avoided: number;
  per_category: Record<string, number>;
  top_departments: Record<string, number>;
  appeals_summary: { resolved: number; total: number };
  risk_trend: { date: string; incidents: number }[];
}

// dataviz skill (choosing-a-form.md): "Change over time, one measure | line
// | sequential (one hue)" -- risk_trend is exactly this: incident count per
// day, a single series. One line, no legend (title names the one series),
// same slot-1 blue already validated for this app's light-only surface in
// components/usage-by-department.tsx (node scripts/validate_palette.js
// "#2a78d6" --mode light -> PASS); reusing it here keeps every chart in the
// dashboard reading as one system rather than introducing a second hue for
// no reason.
const LINE_COLOR = "#2a78d6";
const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";
const SURFACE = "#fcfcfb";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border px-2 py-1 text-xs shadow" style={{ background: SURFACE }}>
      <div className="font-semibold">{payload[0].value} incidents</div>
      <div className="text-gray-500">{label}</div>
    </div>
  );
}

export function ExecutiveReport() {
  const [data, setData] = useState<ExecutiveReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/reports/executive")
      .then((d) => { if (active) setData(d as ExecutiveReportData); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load report"); });
    return () => { active = false; };
  }, []);

  return (
    <main className="report-page mx-auto max-w-4xl p-8">
      <div className="report-no-print mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Executive report</h1>
        <button onClick={() => window.print()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
          Print / Save as PDF
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {!data && !error && <div className="text-sm text-gray-500">Loading…</div>}

      {data && (
        <div data-testid="executive-report" className="grid gap-6">
          <div className="report-section report-stat-grid grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-gray-500">Incidents avoided</div>
              <div data-testid="incidents-avoided" className="text-3xl font-semibold">{data.incidents_avoided}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-gray-500">Exposure avoided</div>
              <div data-testid="exposure-avoided" className="text-3xl font-semibold">{formatCurrency(data.exposure_avoided)}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-gray-500">Appeals resolved</div>
              <div data-testid="appeals-summary" className="text-3xl font-semibold">
                {data.appeals_summary.resolved}/{data.appeals_summary.total}
              </div>
            </div>
          </div>

          <div className="report-section rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-medium">Risk trend</h2>
            {data.risk_trend.length === 0 ? (
              <div className="text-sm text-gray-500">No incidents recorded in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.risk_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: GRID_COLOR }} />
                  {/* 2px line, no dots per point (marks-and-anatomy.md line spec);
                      dot only on hover via activeDot. */}
                  <Line type="monotone" dataKey="incidents" stroke={LINE_COLOR} strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="report-section rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-medium">Top departments by incident count</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th>Department</th><th>Incidents</th></tr></thead>
              <tbody>
                {Object.entries(data.top_departments)
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, count]) => (
                    <tr key={dept} className="border-t"><td className="py-1">{dept}</td><td>{count}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="report-section rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-medium">Exposure avoided by category</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th>Category</th><th>Exposure avoided</th></tr></thead>
              <tbody>
                {Object.entries(data.per_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <tr key={cat} className="border-t"><td className="py-1">{cat}</td><td>{formatCurrency(amount)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
