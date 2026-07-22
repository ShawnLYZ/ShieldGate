"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase";
import type { IncidentRow, ToolRow } from "@/lib/types";

// dataviz skill: story 39's "usage by tier" splits each tier's prompt volume by
// outcome (allowed / warned / blocked). Outcome severity is ORDINAL, and the
// green/amber/red status trio fails the validator as adjacent stacked fills
// (deutan ΔE 2.4–3.2 — green/amber/red merge for deuteranopes), so per
// color-formula.md the ordered category takes a SEQUENTIAL one-hue ramp:
// slot-1 blue, light→dark = allowed→blocked. Lightness carries the order and
// survives every CVD type. Validated:
//   node scripts/validate_palette.js "#9dc1ee,#2a78d6,#164a8c" --mode light
//   -> CVD separation PASS (worst adjacent ΔE 16.2), normal-vision PASS (16.6),
//      lightness strictly monotonic 0.80 → 0.59 → 0.41 (the sequential-scope
//      check; the categorical band does not apply to a ramp),
//      #9dc1ee contrast WARN → relief shipped: legend + table view below.
const RAMP = { allowed: "#9dc1ee", warned: "#2a78d6", blocked: "#164a8c" } as const;
const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";
const SURFACE = "#fcfcfb";

interface TierRow { tier: string; allowed: number; warned: number; blocked: number }

const CLASS_OF: Record<string, keyof typeof RAMP> = {
  allow_usage: "allowed", warn: "warned", block: "blocked",
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ dataKey: string; value: number; fill: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border px-2 py-1 text-xs shadow" style={{ background: SURFACE }}>
      <div className="mb-1 text-gray-500">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.fill }} />
          <span className="font-semibold">{p.value.toLocaleString()}</span>
          <span className="text-gray-500">{p.dataKey}</span>
        </div>
      ))}
    </div>
  );
}

export function UsageByTier() {
  const [events, setEvents] = useState<Pick<IncidentRow, "event_type" | "tool_id" | "direction">[]>([]);
  const [tools, setTools] = useState<Pick<ToolRow, "id" | "tier">[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showTable, setShowTable] = useState(false);

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
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Usage by tool tier</h2>
        <button onClick={() => setShowTable((s) => !s)} className="text-xs text-gray-500 underline">
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : empty ? (
        <div className="text-sm text-gray-500">No prompt activity visible for this account.</div>
      ) : showTable ? (
        <table className="w-full text-sm" data-testid="usage-by-tier-table">
          <thead><tr className="text-left text-gray-500">
            <th>Tier</th><th>Allowed</th><th>Warned</th><th>Blocked</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.tier} className="border-t">
                <td className="py-1">{d.tier}</td><td>{d.allowed}</td><td>{d.warned}</td><td>{d.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="tier" tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: SURFACE, opacity: 0.6 }} />
            {/* ≥2 series → legend present (identity never color-alone); text in
                ink tokens, marks carry the hue. */}
            <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} iconSize={8} />
            {/* stacked segments with a 2px surface gap (marks-and-anatomy.md);
                only the top of the stack gets the 4px rounded data-end. */}
            <Bar dataKey="allowed" stackId="usage" fill={RAMP.allowed} maxBarSize={24}
              stroke={SURFACE} strokeWidth={2} />
            <Bar dataKey="warned" stackId="usage" fill={RAMP.warned} maxBarSize={24}
              stroke={SURFACE} strokeWidth={2} />
            <Bar dataKey="blocked" stackId="usage" fill={RAMP.blocked} maxBarSize={24}
              stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
