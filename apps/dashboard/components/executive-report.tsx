"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";
import { useChartTheme } from "@/lib/chart-theme";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { GradientButton } from "@/components/ui/gradient-button";
import {
  AlertTriangleIcon,
  CoinsIcon,
  FileTextIcon,
  ScaleIcon,
} from "@/components/ui/icons";
import { ErrorNote, Loading } from "@/components/ui/page";
import { StatTile } from "@/components/ui/stat";
import { TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

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
// same slot-1 hue every other chart in this app uses, read from
// lib/chart-theme so the printed (forced-light) rendering and the on-screen
// dark rendering each get the value validated for their own surface.
function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function ExecutiveReport() {
  const [data, setData] = useState<ExecutiveReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chart = useChartTheme();

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/reports/executive")
      .then((d) => { if (active) setData(d as ExecutiveReportData); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load report"); });
    return () => { active = false; };
  }, []);

  return (
    <main className="report-page relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="report-no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sg-accent-text)]">
            Evidence
          </div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--sg-fg)]">
            Executive report
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--sg-muted)]">
            Board-facing summary. Printing forces a light, ink-cheap rendering and drops the app
            chrome, so what you save as a PDF is only the report.
          </p>
        </div>
        <GradientButton onClick={() => window.print()} size="sm">
          <FileTextIcon size={13} />
          Print / Save as PDF
        </GradientButton>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <Loading label="Compiling report…" />}

      {data && (
        <div data-testid="executive-report" className="grid gap-4">
          <div className="report-section report-stat-grid grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Incidents avoided"
              tone="warn"
              icon={<AlertTriangleIcon size={16} />}
              value={<span data-testid="incidents-avoided">{data.incidents_avoided}</span>}
            />
            <StatTile
              label="Exposure avoided"
              tone="allow"
              icon={<CoinsIcon size={16} />}
              value={<span data-testid="exposure-avoided">{formatCurrency(data.exposure_avoided)}</span>}
            />
            <StatTile
              label="Appeals resolved"
              icon={<ScaleIcon size={16} />}
              value={
                <span data-testid="appeals-summary">
                  {data.appeals_summary.resolved}/{data.appeals_summary.total}
                </span>
              }
            />
          </div>

          <Card className="report-section">
            <CardHeader><CardTitle>Risk trend</CardTitle></CardHeader>
            <CardBody>
              {data.risk_trend.length === 0 ? (
                <div className="py-6 text-sm text-[var(--sg-muted)]">
                  No incidents recorded in this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.risk_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: chart.axis, fontSize: 11 }}
                      axisLine={{ stroke: chart.grid }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: chart.axis, fontSize: 11 }}
                      axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<ChartTooltip unit="incidents" />} cursor={{ stroke: chart.grid }} />
                    {/* 2px line, no dots per point (marks-and-anatomy.md line spec);
                        dot only on hover via activeDot. */}
                    <Line type="monotone" dataKey="incidents" stroke={chart.solo} strokeWidth={2}
                      dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card className="report-section">
            <CardHeader><CardTitle>Top departments by incident count</CardTitle></CardHeader>
            <TableScroll>
              <Table>
                <THead><tr><th>Department</th><th>Incidents</th></tr></THead>
                <TBody>
                  {Object.entries(data.top_departments)
                    .sort((a, b) => b[1] - a[1])
                    .map(([dept, count]) => (
                      <Tr key={dept}>
                        <Td>{dept}</Td>
                        <Td numeric>{count}</Td>
                      </Tr>
                    ))}
                </TBody>
              </Table>
            </TableScroll>
          </Card>

          <Card className="report-section">
            <CardHeader><CardTitle>Exposure avoided by category</CardTitle></CardHeader>
            <TableScroll>
              <Table>
                <THead><tr><th>Category</th><th>Exposure avoided</th></tr></THead>
                <TBody>
                  {Object.entries(data.per_category)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amount]) => (
                      <Tr key={cat}>
                        <Td className="capitalize">{cat}</Td>
                        <Td numeric>{formatCurrency(amount)}</Td>
                      </Tr>
                    ))}
                </TBody>
              </Table>
            </TableScroll>
          </Card>
        </div>
      )}
    </main>
  );
}
