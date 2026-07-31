"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";
import { useChartTheme } from "@/lib/chart-theme";
import type { IncidentRow } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { GradientButton } from "@/components/ui/gradient-button";
import { ErrorNote, Loading } from "@/components/ui/page";
import { TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

// dataviz skill (choosing-a-form.md): "Compare magnitude, low -> high | bar/column
// | sequential (one hue)" -- same job as usage-by-department.tsx (one measure,
// event count, across a nominal category), just two categories worth grouping
// by (tool, department), so this reuses that component's exact treatment
// rather than inventing a second chart language: same validated slot-1 hue
// (via lib/chart-theme's `solo`), same single-hue-no-legend rule (one series
// per chart, the title names it), same table-view twin per chart.
interface Count { key: string; count: number }

function GroupedBar({ title, data, showTable, onToggle }: {
  title: string; data: Count[]; showTable: boolean; onToggle: () => void;
}) {
  const chart = useChartTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <GradientButton onClick={onToggle} size="sm" variant="ghost">
          {showTable ? "View as chart" : "View as table"}
        </GradientButton>
      </CardHeader>
      <CardBody>
        {data.length === 0 ? (
          <div className="py-6 text-sm text-[var(--sg-muted)]">No flagged output events.</div>
        ) : showTable ? (
          <TableScroll>
            <Table>
              <THead><tr><th>{title}</th><th>Flags</th></tr></THead>
              <TBody>
                {data.map((d) => (
                  <Tr key={d.key}>
                    <Td>{d.key}</Td>
                    <Td numeric>{d.count}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="key" tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={{ stroke: chart.grid }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={false} tickLine={false} width={32} />
              <Tooltip
                content={<ChartTooltip labelKey="key" unit="flags" />}
                cursor={{ fill: chart.axis, opacity: 0.12 }}
              />
              <Bar dataKey="count" fill={chart.solo} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
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

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!loaded) return <Loading />;

  return (
    <div data-testid="output-risk-panel" className="grid gap-4 xl:grid-cols-2">
      <GroupedBar title="By tool" data={byTool} showTable={showToolTable} onToggle={() => setShowToolTable((s) => !s)} />
      <GroupedBar title="By department" data={byDept} showTable={showDeptTable} onToggle={() => setShowDeptTable((s) => !s)} />
    </div>
  );
}
