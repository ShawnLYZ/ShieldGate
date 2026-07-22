"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedGet, authedPost, getAccessToken } from "@/lib/api";
import type { ApprovalRequestRow } from "@/lib/types";

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

const SLA_BADGE: Record<ApprovalRequestRow["sla_state"], string> = {
  on_track: "bg-green-100 text-green-800",
  at_risk: "bg-amber-100 text-amber-800",
  breached: "bg-red-100 text-red-800",
};

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

  return (
    <div>
      {canDecide && (
        <div className="mb-2 flex justify-end">
          <button data-testid="export-approvals" onClick={exportCsv}
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
            Export CSV
          </button>
        </div>
      )}
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th className="p-2">Tool</th><th>Department</th><th>Status</th>
          <th>Risk score</th><th>SLA</th><th>Reviewers</th>{canDecide && <th>Decision</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} data-testid="approval-row" className="border-t align-top">
            <td className="p-2">
              <div className="font-medium">{r.tool_name}</div>
              <div className="text-xs text-gray-500">{r.purpose}</div>
            </td>
            <td className="p-2">{r.department}</td>
            <td className="p-2">{r.status}</td>
            <td className="p-2">
              <details>
                <summary className="cursor-pointer">{r.risk_score ?? "—"}</summary>
                <ul className="mt-1 text-xs text-gray-600">
                  {Object.entries(r.risk_signals ?? {}).map(([k, v]) => (
                    <li key={k}>{k}: {String(v)}</li>
                  ))}
                </ul>
              </details>
            </td>
            <td className="p-2">
              <span className={`rounded px-2 py-0.5 text-xs ${SLA_BADGE[r.sla_state]}`}>
                {r.sla_state.replace("_", " ")}
              </span>
              <div className="text-xs text-gray-500">{formatCountdown(r.sla_due_at, r.sla_state)}</div>
            </td>
            <td className="p-2 text-xs" data-testid="decision-trail">
              <div>Manager: {trailLine(r.manager_decision, r.manager_reviewer_name, r.manager_decided_at)}</div>
              <div>Admin: {trailLine(r.admin_decision, r.admin_reviewer_name, r.admin_decided_at)}</div>
              {r.assigned_tier != null && (
                <div className="text-gray-500">assigned Tier {r.assigned_tier}</div>
              )}
            </td>
            {canDecide && (
              <td className="p-2">
                <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                  Tier
                  <select
                    data-testid={`tier-${r.id}`}
                    value={tiers[r.id] ?? r.assigned_tier ?? r.recommended_tier ?? 0}
                    onChange={(e) => setTiers((t) => ({ ...t, [r.id]: Number(e.target.value) }))}
                    className="rounded border px-1 py-0.5 text-xs"
                  >
                    <option value={0}>0 — unapproved</option>
                    <option value={1}>1 — restricted</option>
                    <option value={2}>2 — enterprise</option>
                  </select>
                </label>
                <input
                  type="text"
                  placeholder="note (optional)"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  className="mb-1 w-32 rounded border px-1 py-0.5 text-xs"
                />
                <div className="flex gap-1">
                  <button data-testid={`approve-${r.id}`} disabled={pending[r.id]}
                    onClick={() => decide(r, "approve")}
                    className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50">
                    Approve
                  </button>
                  <button data-testid={`reject-${r.id}`} disabled={pending[r.id]}
                    onClick={() => decide(r, "reject")}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">
                    Reject
                  </button>
                  <button data-testid={`info-${r.id}`} disabled={pending[r.id]}
                    onClick={() => decide(r, "info")}
                    className="rounded bg-gray-500 px-2 py-1 text-xs text-white disabled:opacity-50">
                    Request info
                  </button>
                </div>
                {errors[r.id] && <div className="text-xs text-red-600">{errors[r.id]}</div>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
