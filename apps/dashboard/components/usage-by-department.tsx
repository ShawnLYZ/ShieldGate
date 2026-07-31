"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase";
import { useChartTheme } from "@/lib/chart-theme";
import type { IncidentRow } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { GradientButton } from "@/components/ui/gradient-button";
import { Loading } from "@/components/ui/page";
import { TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

// dataviz skill (references/choosing-a-form.md): "Compare magnitude, low ->
// high | bar/column | sequential (one hue)" -- usage-by-department is exactly
// this job: one measure (event count) across a nominal category (department
// has no natural order, so it is NOT ordinal). references/color-formula.md:
// a single nominal series takes the *same* slot-1 hue for every bar, with no
// legend box -- the chart title already names the one thing plotted; coloring
// bars by department identity here would double-encode identity the x-axis
// already shows and burn the categorical channel for nothing.
//
// Slot-1 blue (#2a78d6) was validated for this exact role:
//   node scripts/validate_palette.js "#2a78d6" --mode light
//   -> lightness band PASS, chroma floor PASS, contrast-vs-surface PASS
// The console now has a light/dark toggle, so that literal moved into
// app/globals.css as --sg-chart-solo (light mode keeps #2a78d6 exactly; dark
// mode uses its re-derived twin for a #111827 surface) and is read here via
// useChartTheme. Same hue discipline, two surfaces.
interface DeptCount { department: string; count: number }

export function UsageByDepartment() {
  const [rows, setRows] = useState<Pick<IncidentRow, "department">[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const chart = useChartTheme();

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
    <Card>
      <CardHeader>
        <CardTitle>Usage by department</CardTitle>
        {/* Every chart has a table-view twin (anti-patterns.md) -- the
            WCAG-clean equivalent for anyone who can't (or doesn't want to)
            read bar length. */}
        <GradientButton onClick={() => setShowTable((s) => !s)} size="sm" variant="ghost">
          {showTable ? "View as chart" : "View as table"}
        </GradientButton>
      </CardHeader>
      <CardBody>
        {!loaded ? (
          <Loading className="px-0" />
        ) : data.length === 0 ? (
          <div className="py-6 text-sm text-[var(--sg-muted)]">No activity visible for this account.</div>
        ) : showTable ? (
          <TableScroll>
            <Table>
              <THead><tr><th>Department</th><th>Events</th></tr></THead>
              <TBody>
                {data.map((d) => (
                  <Tr key={d.department}>
                    <Td>{d.department}</Td>
                    <Td numeric>{d.count}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="department" tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={{ stroke: chart.grid }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={false} tickLine={false} width={32} />
              {/* Bar/cell hover tooltip, not a crosshair (interaction.md: bars
                  use per-mark hover, the mark itself is the hit target). */}
              <Tooltip
                content={<ChartTooltip labelKey="department" />}
                cursor={{ fill: chart.axis, opacity: 0.12 }}
              />
              {/* <=24px thick, 4px rounded top / square at the baseline
                  (marks-and-anatomy.md mark spec for bar/column). */}
              <Bar dataKey="count" fill={chart.solo} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
