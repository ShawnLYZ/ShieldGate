"use client";
import { useEffect, useState } from "react";
import { authedGet, authedPost } from "@/lib/api";
import type { AppealRow, DecisionRegistrationRow } from "@/lib/types";

const STATUS_BADGE: Record<AppealRow["status"], string> = {
  open: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

export function DecisionsPanel() {
  const [decisions, setDecisions] = useState<DecisionRegistrationRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      const [d, a] = await Promise.all([
        authedGet("/api/v1/decisions"),
        authedGet("/api/v1/appeals"),
      ]);
      setDecisions(d as DecisionRegistrationRow[]);
      setAppeals(a as AppealRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(appeal: AppealRow) {
    setPending((p) => ({ ...p, [appeal.id]: true }));
    try {
      await authedPost(`/api/v1/appeals/${appeal.id}/resolve`, { note: notes[appeal.id]?.trim() || "Resolved." });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setPending((p) => ({ ...p, [appeal.id]: false }));
    }
  }

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!loaded) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-lg font-medium">Decision registrations</h2>
        {decisions.length === 0 ? (
          <div className="text-sm text-gray-500">No decisions registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500">
              <th className="p-2">Reference</th><th>System</th><th>Model</th><th>Decided</th>
            </tr></thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.public_ref} data-testid="decision-row" className="border-t">
                  <td className="p-2 font-medium">{d.public_ref}</td>
                  <td>{d.system_name}</td>
                  <td>{d.model_used}</td>
                  <td>{new Date(d.decided_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-lg font-medium">Appeals</h2>
        {appeals.length === 0 ? (
          <div className="text-sm text-gray-500">No appeals filed yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500">
              <th className="p-2">Reference</th><th>Decision</th><th>Reason</th>
              <th>Status</th><th>Filed</th><th>Resolve</th>
            </tr></thead>
            <tbody>
              {appeals.map((a) => (
                <tr key={a.id} data-testid="appeal-row" className="border-t align-top">
                  <td className="p-2 font-medium">{a.public_ref}</td>
                  <td>{a.decision_ref}</td>
                  <td className="max-w-xs truncate" title={a.reason}>{a.reason}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[a.status]}`}>
                      {a.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>
                    {a.status === "resolved" ? (
                      <span className="text-xs text-gray-500">{a.resolution_note ?? "—"}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="resolution note"
                          value={notes[a.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          className="w-40 rounded border px-1 py-0.5 text-xs"
                        />
                        <button data-testid={`resolve-appeal-${a.id}`} disabled={pending[a.id]}
                          onClick={() => resolve(a)}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50">
                          Resolve
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
