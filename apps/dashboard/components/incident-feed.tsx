"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { IncidentRow } from "@/lib/types";

type ToolInfo = { name: string; tier: number };

export function IncidentFeed() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [tools, setTools] = useState<Record<string, ToolInfo>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    (async () => {
      // Realtime authorizes each postgres_changes message using whichever JWT
      // the channel joined with. createClient()'s session restore from
      // localStorage is async; subscribing before it resolves joins the
      // channel under the anon key, so every row after arrives as {} with
      // "Error 401: Unauthorized" (RLS never gets evaluated — the base grant
      // check for anon fails first). Awaiting the session and setting it on
      // the realtime client explicitly guarantees the channel joins already
      // authenticated as the logged-in user.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (!active) return;

      // One-time reference read for the drilldown's tier line (tools is an
      // RLS-open reference table). Tier isn't stored on the event row, so this
      // is the tool's CURRENT tier — labeled as such in the UI.
      const { data: toolRows } = await supabase.from("tools").select("id,name,tier");
      if (active && toolRows) {
        setTools(Object.fromEntries(toolRows.map((t) => [t.id, { name: t.name, tier: t.tier }])));
      }

      const { data } = await supabase.from("audit_events").select("*")
        .order("seq", { ascending: false }).limit(50);
      if (active && data) setRows(data as IncidentRow[]);

      channel = supabase.channel("incidents")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_events" },
          (payload) => setRows((prev) => [payload.new as IncidentRow, ...prev].slice(0, 50)))
        .subscribe();
    })();

    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, []);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-gray-500">
        <th className="p-2">Time</th><th>Action</th><th>Category</th><th>Tool</th>
        <th>Dept</th><th>Employee</th><th>Excerpt</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const tool = r.tool_id ? tools[r.tool_id] : undefined;
          return [
            <tr key={r.id} data-testid="incident-row" onClick={() => toggle(r.id)}
              className="cursor-pointer border-t hover:bg-gray-50"
              title="Click for details">
              <td className="p-2">
                <span className="mr-1 text-gray-400">{open[r.id] ? "▾" : "▸"}</span>
                {new Date(r.created_at).toLocaleTimeString()}
              </td>
              <td><span className={r.matrix_action === "block" ? "text-red-700" : "text-amber-700"}>{r.event_type}</span></td>
              <td>{r.data_category ?? "—"}</td><td>{r.tool_domain ?? "—"}</td>
              <td>{r.department ?? "—"}</td><td>{r.employee_pseudonym ?? "—"}</td>
              <td className="max-w-xs truncate">{r.masked_excerpt ?? "—"}</td>
            </tr>,
            open[r.id] && (
              // Story 20 drilldown: classification, pattern types, tool, tier,
              // action, masked excerpt — judge severity without raw content.
              <tr key={`${r.id}-detail`} data-testid="incident-detail" className="bg-gray-50">
                <td colSpan={7} className="p-3 text-xs">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-gray-500">Tool · tier (current)</div>
                      <div>{tool ? `${tool.name} · Tier ${tool.tier}` : "unregistered tool"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Direction</div>
                      <div>{r.direction}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Classification → action</div>
                      <div>{r.data_category ?? "—"} → {r.matrix_action ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Enforced</div>
                      <div>{r.degraded
                        ? <span className="rounded bg-amber-100 px-1 text-amber-800">degraded (offline)</span>
                        : "live backend"}</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-500">Pattern types: </span>
                    {r.pattern_types.length
                      ? r.pattern_types.map((p) => (
                          <span key={p} className="mr-1 rounded bg-gray-200 px-1.5 py-0.5">{p}</span>))
                      : "none (context finding)"}
                  </div>
                  <div className="mt-2">
                    <div className="text-gray-500">Masked excerpt</div>
                    <div className="whitespace-pre-wrap break-all font-mono">{r.masked_excerpt ?? "—"}</div>
                  </div>
                </td>
              </tr>
            ),
          ];
        })}
      </tbody>
    </table>
  );
}
