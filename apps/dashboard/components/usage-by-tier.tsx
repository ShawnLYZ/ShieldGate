"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase";
import { useChartTheme } from "@/lib/chart-theme";
import type { IncidentRow, ToolRow } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { GradientButton } from "@/components/ui/gradient-button";
import { Loading } from "@/components/ui/page";
import { TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

// dataviz skill: story 39's "usage by tier" splits each tier's prompt volume by
// outcome (allowed / warned / blocked). Outcome severity is ORDINAL, and the
// green/amber/red status trio fails the validator as adjacent stacked fills
// (deutan ΔE 2.4–3.2 — green/amber/red merge for deuteranopes), so per
// color-formula.md the ordered category takes a SEQUENTIAL one-hue ramp:
// slot-1 blue, with lightness carrying allowed→warned→blocked. Lightness
// survives every CVD type where hue does not. Validated:
//   node scripts/validate_palette.js "#9dc1ee,#2a78d6,#164a8c" --mode light
//   -> CVD separation PASS (worst adjacent ΔE 16.2), normal-vision PASS (16.6),
//      lightness strictly monotonic 0.80 → 0.59 → 0.41 (the sequential-scope
//      check; the categorical band does not apply to a ramp),
//      #9dc1ee contrast WARN → relief shipped: legend + table view below.
//
// Those three literals now live in app/globals.css as --sg-chart-1..3 and are
// read via useChartTheme, because the console gained a light/dark toggle. Light
// mode keeps the validated ramp byte-for-byte; dark mode uses the same ramp
// re-derived for a #111827 surface, where the direction inverts (brighter =
// more severe) so lightness stays monotonic *against its own background*.
interface TierRow { tier: string; allowed: number; warned: number; blocked: number }

const CLASS_OF: Record<string, "allowed" | "warned" | "blocked"> = {
  allow_usage: "allowed", warn: "warned", block: "blocked",
};

export function UsageByTier() {
  const [events, setEvents] = useState<Pick<IncidentRow, "event_type" | "tool_id" | "direction">[]>([]);
  const [tools, setTools] = useState<Pick<ToolRow, "id" | "tier">[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const chart = useChartTheme();

  const ramp = { allowed: chart.ramp[0], warned: chart.ramp[1], blocked: chart.ramp[2] };

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    Promise.all([
      supabase.from("audit_events").select("event_type,tool_id,direction"),
      supabase.from("tools").select("id,tier"),
    ]).then(([ev, tl]) => {
      if (!active) return;
      setEvents((ev.data as typeof events | null) ?? []);
      setTools((tl.data as typeof tools | null) ?? []);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const data = useMemo<TierRow[]>(() => {
    const tierOf = new Map(tools.map((t) => [t.id, t.tier]));
    // fixed x domain: all three tiers always render, zeros included, so the
    // comparative shape is stable. Unregistered tools are enforced as Tier 0
    // (policy.engine.resolve_tool), so their events count there too.
    const rows: TierRow[] = [0, 1, 2].map((t) => ({
      tier: `Tier ${t}`, allowed: 0, warned: 0, blocked: 0,
    }));
    for (const e of events) {
      const cls = e.direction === "prompt" ? CLASS_OF[e.event_type] : undefined;
      if (!cls) continue;
      const tier = (e.tool_id != null ? tierOf.get(e.tool_id) : undefined) ?? 0;
      rows[tier][cls] += 1;
    }
    return rows;
  }, [events, tools]);

  const empty = data.every((d) => d.allowed + d.warned + d.blocked === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by tool tier</CardTitle>
        <GradientButton onClick={() => setShowTable((s) => !s)} size="sm" variant="ghost">
          {showTable ? "View as chart" : "View as table"}
        </GradientButton>
      </CardHeader>
      <CardBody>
        {!loaded ? (
          <Loading className="px-0" />
        ) : empty ? (
          <div className="py-6 text-sm text-[var(--sg-muted)]">No prompt activity visible for this account.</div>
        ) : showTable ? (
          <TableScroll>
            <Table data-testid="usage-by-tier-table">
              <THead>
                <tr><th>Tier</th><th>Allowed</th><th>Warned</th><th>Blocked</th></tr>
              </THead>
              <TBody>
                {data.map((d) => (
                  <Tr key={d.tier}>
                    <Td>{d.tier}</Td>
                    <Td numeric>{d.allowed}</Td>
                    <Td numeric>{d.warned}</Td>
                    <Td numeric>{d.blocked}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="tier" tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={{ stroke: chart.grid }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: chart.axis, fontSize: 12 }}
                axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.axis, opacity: 0.12 }} />
              {/* ≥2 series → legend present (identity never color-alone); text in
                  ink tokens, marks carry the hue. */}
              <Legend wrapperStyle={{ fontSize: 12, color: chart.axis }} iconSize={8} />
              {/* stacked segments with a 2px surface gap (marks-and-anatomy.md);
                  only the top of the stack gets the 4px rounded data-end. */}
              <Bar dataKey="allowed" stackId="usage" fill={ramp.allowed} maxBarSize={24}
                stroke={chart.surface} strokeWidth={2} />
              <Bar dataKey="warned" stackId="usage" fill={ramp.warned} maxBarSize={24}
                stroke={chart.surface} strokeWidth={2} />
              <Bar dataKey="blocked" stackId="usage" fill={ramp.blocked} maxBarSize={24}
                stroke={chart.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
