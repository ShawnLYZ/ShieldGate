"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { IncidentRow } from "@/lib/types";
import { Badge, TierBadge, VerdictBadge } from "@/components/ui/badge";
import { ChevronDownIcon, ChevronRightIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

type ToolInfo = { name: string; tier: number };

export function IncidentFeed() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [tools, setTools] = useState<Record<string, ToolInfo>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
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
      if (active) setLoaded(true);

      channel = supabase.channel("incidents")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_events" },
          (payload) => setRows((prev) => [payload.new as IncidentRow, ...prev].slice(0, 50)))
        .subscribe();
    })();

    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, []);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <TableScroll>
      <Table>
        <THead>
          <tr>
            <th>Time</th><th>Action</th><th>Category</th><th>Tool</th>
            <th>Dept</th><th>Employee</th><th>Excerpt</th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={7}>
              {loaded ? (
                <EmptyState
                  icon={<ShieldCheckIcon size={18} />}
                  title="No incidents yet"
                  description="Send a prompt containing sensitive data from a monitored AI site and it will appear here within a second."
                />
              ) : (
                "Loading…"
              )}
            </EmptyRow>
          )}
          {rows.map((r) => {
            const tool = r.tool_id ? tools[r.tool_id] : undefined;
            const isOpen = !!open[r.id];
            return [
              <Tr key={r.id} data-testid="incident-row" interactive onClick={() => toggle(r.id)}
                title="Click for details">
                <Td className="whitespace-nowrap">
                  <span className="mr-1 inline-block align-[-2px] text-[var(--sg-muted)]">
                    {isOpen ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
                  </span>
                  <span className="tabular-nums">{new Date(r.created_at).toLocaleTimeString()}</span>
                </Td>
                <Td>
                  {/* The event type is the label; the verdict badge carries the
                      severity. Colour never has to do the work alone. */}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <VerdictBadge action={r.matrix_action} />
                    <span className="text-[var(--sg-fg-secondary)]">{r.event_type}</span>
                  </span>
                </Td>
                <Td muted>{r.data_category ?? "—"}</Td>
                <Td className="whitespace-nowrap">{r.tool_domain ?? "—"}</Td>
                <Td muted>{r.department ?? "—"}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">{r.employee_pseudonym ?? "—"}</Td>
                <Td className="max-w-[22ch] truncate text-[var(--sg-muted)]">{r.masked_excerpt ?? "—"}</Td>
              </Tr>,
              isOpen && (
                // Story 20 drilldown: classification, pattern types, tool, tier,
                // action, masked excerpt — judge severity without raw content.
                <tr key={`${r.id}-detail`} data-testid="incident-detail" className="bg-[var(--sg-surface-2)]">
                  <td colSpan={7} className="px-3 py-3 text-xs">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                          Tool · tier (current)
                        </div>
                        {tool ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[var(--sg-fg)]">{tool.name}</span>
                            <TierBadge tier={tool.tier} short />
                          </div>
                        ) : (
                          <Badge>unregistered tool</Badge>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                          Direction
                        </div>
                        <div className="text-[var(--sg-fg)]">{r.direction}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                          Classification → action
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--sg-fg)]">{r.data_category ?? "—"}</span>
                          <span className="text-[var(--sg-muted)]">→</span>
                          <VerdictBadge action={r.matrix_action} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                          Enforced
                        </div>
                        <div>
                          {r.degraded
                            ? <Badge tone="warn">degraded (offline)</Badge>
                            : <span className="text-[var(--sg-fg)]">live backend</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                        Pattern types
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.pattern_types.length
                          ? r.pattern_types.map((p) => <Badge key={p}>{p}</Badge>)
                          : <span className="text-[var(--sg-muted)]">none (context finding)</span>}
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                        Masked excerpt
                      </div>
                      <div className="whitespace-pre-wrap break-all rounded-[var(--sg-radius-sm)] border border-[var(--sg-border)] bg-[var(--sg-surface)] p-2 font-mono text-[11px] leading-relaxed text-[var(--sg-fg-secondary)]">
                        {r.masked_excerpt ?? "—"}
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
