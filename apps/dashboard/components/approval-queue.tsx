"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedGet, authedPost, getAccessToken } from "@/lib/api";
import type { ApprovalRequestRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorNote } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";
import {
  BanIcon,
  CheckIcon,
  ClipboardCheckIcon,
  ClockIcon,
  DownloadIcon,
  InfoIcon,
} from "@/components/ui/icons";

type Role = "admin" | "manager" | "employee" | null;

function formatCountdown(dueAt: string, slaState: ApprovalRequestRow["sla_state"]): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (slaState === "breached" || diffMs <= 0) return "Breached";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

// Story 53: each decision line shows verb · reviewer · date, or "pending".
function trailLine(decision: string | null, name?: string | null, at?: string | null): string {
  if (!decision) return "pending";
  const when = at ? ` · ${new Date(at).toLocaleDateString()}` : "";
  return `${decision}${name ? ` · ${name}` : ""}${when}`;
}

async function exportCsv() {
  const token = await getAccessToken();
  const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/export.csv`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "shieldgate-approvals.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ApprovalQueue() {
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [, forceTick] = useState(0);

  // Re-render periodically so SLA countdowns count down without a refetch.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    (async () => {
      // Realtime authorizes each postgres_changes message using whichever JWT
      // the channel joined with. createClient()'s session restore from
      // localStorage is async; subscribing before it resolves joins the
      // channel under the anon key, so every row after arrives as {} with
      // "Error 401: Unauthorized" (same fix as components/incident-feed.tsx).
      // Awaiting the session and setting it on the realtime client explicitly
      // guarantees the channel joins already authenticated as the logged-in
      // user.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (!active) return;

      if (session) {
        const { data: profile } = await supabase.from("profiles").select("role")
          .eq("id", session.user.id).single();
        if (active && profile) setRole(profile.role as Role);
      }

      // Rows come from the backend list rather than PostgREST: it joins reviewer
      // display names, which RLS hides from non-admin clients (story 53). Realtime
      // stays the liveness trigger — any insert/update refetches the joined list.
      const loadRows = async () => {
        try {
          const data = await authedGet("/api/v1/approvals") as ApprovalRequestRow[];
          if (active) setRows(data);
        } catch { /* backend briefly unreachable — keep the rows we have */ }
        finally { if (active) setLoaded(true); }
      };
      await loadRows();

      channel = supabase.channel("approval-requests")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "approval_requests" }, loadRows)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "approval_requests" }, loadRows)
        .subscribe();
    })();

    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, []);

  async function decide(row: ApprovalRequestRow, decision: "approve" | "reject" | "info") {
    setPending((p) => ({ ...p, [row.id]: true }));
    setErrors((e) => ({ ...e, [row.id]: "" }));
    try {
      await authedPost(`/api/v1/approvals/${row.id}/decision`, {
        decision,
        // The risk score *recommends* a tier band (design §7); the reviewer
        // assigns the actual tier, which is what lands in the Tool Registry.
        tier: tiers[row.id] ?? row.assigned_tier ?? row.recommended_tier ?? null,
        note: notes[row.id]?.trim() || null,
      });
      // The realtime UPDATE subscription above refreshes this row once the
      // backend commits the decision; no local mutation needed here.
    } catch (err) {
      setErrors((e) => ({ ...e, [row.id]: err instanceof Error ? err.message : "Decision failed" }));
    } finally {
      setPending((p) => ({ ...p, [row.id]: false }));
    }
  }

  const canDecide = role === "manager" || role === "admin";
  const colCount = canDecide ? 7 : 6;

  return (
    <div>
      {canDecide && (
        <div className="flex justify-end border-b border-[var(--sg-border)] px-4 py-2.5">
          <GradientButton data-testid="export-approvals" onClick={exportCsv} size="sm" variant="ghost">
            <DownloadIcon size={13} />
            Export CSV
          </GradientButton>
        </div>
      )}
      <TableScroll>
        <Table>
          <THead>
            <tr>
              <th>Tool</th><th>Department</th><th>Status</th>
              <th>Risk score</th><th>SLA</th><th>Reviewers</th>{canDecide && <th>Decision</th>}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={colCount}>
                {loaded ? (
                  <EmptyState
                    icon={<ClipboardCheckIcon size={18} />}
                    title="Nothing waiting on you"
                    description="Requests raised from the extension's block panel land here, already scored."
                  />
                ) : (
                  "Loading…"
                )}
              </EmptyRow>
            )}
            {rows.map((r) => (
              <Tr key={r.id} data-testid="approval-row">
                <Td>
                  <div className="font-medium text-[var(--sg-fg)]">{r.tool_name}</div>
                  <div className="mt-0.5 max-w-[28ch] text-xs text-[var(--sg-muted)]">{r.purpose}</div>
                </Td>
                <Td muted>{r.department}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td>
                  <details className="group">
                    <summary className="cursor-pointer list-none tabular-nums text-[var(--sg-fg)] transition-colors hover:text-[var(--sg-accent-text)]">
                      {r.risk_score ?? "—"}
                      <span className="ml-1 text-[10px] text-[var(--sg-muted)] group-open:hidden">
                        signals
                      </span>
                    </summary>
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--sg-muted)]">
                      {Object.entries(r.risk_signals ?? {}).map(([k, v]) => (
                        <li key={k} className="flex gap-1.5">
                          <span className="text-[var(--sg-faint)]">{k}</span>
                          <span className="text-[var(--sg-fg-secondary)]">{String(v)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </Td>
                <Td>
                  <StatusBadge status={r.sla_state} />
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--sg-muted)]">
                    <ClockIcon size={11} />
                    <span className="tabular-nums">{formatCountdown(r.sla_due_at, r.sla_state)}</span>
                  </div>
                </Td>
                <Td className="text-xs" data-testid="decision-trail">
                  <div className="text-[var(--sg-fg-secondary)]">
                    <span className="text-[var(--sg-muted)]">Manager:</span>{" "}
                    {trailLine(r.manager_decision, r.manager_reviewer_name, r.manager_decided_at)}
                  </div>
                  <div className="text-[var(--sg-fg-secondary)]">
                    <span className="text-[var(--sg-muted)]">Admin:</span>{" "}
                    {trailLine(r.admin_decision, r.admin_reviewer_name, r.admin_decided_at)}
                  </div>
                  {r.assigned_tier != null && (
                    <div className="mt-0.5 text-[var(--sg-muted)]">assigned Tier {r.assigned_tier}</div>
                  )}
                </Td>
                {canDecide && r.status === "auto_rejected" && (
                  <Td>
                    {/* auto_rejected is terminal in the approvals FSM — there is
                        no admin path back out of it. Rendering live Approve /
                        Reject / Info buttons here would offer a reviewer three
                        actions that all fail server-side. */}
                    <span className="text-xs text-[var(--sg-muted)]">
                      Terminal — prohibited-use signature. No reviewer action available.
                    </span>
                  </Td>
                )}
                {canDecide && r.status !== "auto_rejected" && (
                  <Td>
                    <div className="flex w-[232px] flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-[var(--sg-muted)]">
                        Tier
                        <Select
                          data-testid={`tier-${r.id}`}
                          value={tiers[r.id] ?? r.assigned_tier ?? r.recommended_tier ?? 0}
                          onChange={(e) => setTiers((t) => ({ ...t, [r.id]: Number(e.target.value) }))}
                          className="flex-1 px-2 py-1 text-[11px]"
                        >
                          <option value={0}>0 — unapproved</option>
                          <option value={1}>1 — restricted</option>
                          <option value={2}>2 — enterprise</option>
                        </Select>
                      </label>
                      <Input
                        type="text"
                        placeholder="note (optional)"
                        aria-label={`Decision note for ${r.tool_name}`}
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="px-2 py-1 text-[11px]"
                      />
                      <div className="flex flex-wrap gap-1">
                        <GradientButton data-testid={`approve-${r.id}`} disabled={pending[r.id]}
                          onClick={() => decide(r, "approve")} size="sm" variant="success">
                          <CheckIcon size={12} />
                          Approve
                        </GradientButton>
                        <GradientButton data-testid={`reject-${r.id}`} disabled={pending[r.id]}
                          onClick={() => decide(r, "reject")} size="sm" variant="variant">
                          <BanIcon size={12} />
                          Reject
                        </GradientButton>
                        <GradientButton data-testid={`info-${r.id}`} disabled={pending[r.id]}
                          onClick={() => decide(r, "info")} size="sm" variant="neutral">
                          <InfoIcon size={12} />
                          Info
                        </GradientButton>
                      </div>
                      {errors[r.id] && <ErrorNote>{errors[r.id]}</ErrorNote>}
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </div>
  );
}
