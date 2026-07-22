"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPost, getAccessToken } from "@/lib/api";
import type { ShadowCandidateRow } from "@/lib/types";

const STATUS_BADGE: Record<ShadowCandidateRow["status"], string> = {
  new: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  promoted: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-600",
};

export function ShadowQueue() {
  const [rows, setRows] = useState<ShadowCandidateRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importPending, setImportPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await createClient().from("shadow_candidates").select("*")
      .order("last_seen", { ascending: false });
    setRows((data as ShadowCandidateRow[] | null) ?? []);
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "promote" | "dismiss") {
    setPending((p) => ({ ...p, [id]: true }));
    setError(null);
    try {
      await authedPost(`/api/v1/shadow/${id}/${action}`, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  }

  async function importCsv() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setImportPending(true);
    setImportResult(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const base = process.env.NEXT_PUBLIC_BACKEND_URL!;
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${base}/api/v1/shadow/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error(`Import failed (${r.status})`);
      const body = await r.json();
      setImportResult(`Imported: ${body.created} new, ${body.updated} updated, ${body.skipped_known} skipped (already registered).`);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportPending(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 border-b pb-4">
        <input ref={fileInput} type="file" accept=".csv" data-testid="shadow-import-input"
          className="text-sm" />
        <button onClick={importCsv} disabled={importPending}
          data-testid="shadow-import-submit"
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {importPending ? "Importing…" : "Import IdP CSV"}
        </button>
        {importResult && <span className="text-xs text-gray-600">{importResult}</span>}
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No shadow AI candidates found. Import an IdP log to discover unregistered tools.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">Domain</th><th>Source</th><th>Users</th>
              <th>First seen</th><th>Last seen</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="shadow-row" className="border-t">
                <td className="p-2 font-medium">{r.domain}</td>
                <td>{r.source}</td>
                <td>{r.user_count}</td>
                <td>{r.first_seen}</td>
                <td>{r.last_seen}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[r.status]}`}>
                    {r.status.replace("_", " ")}
                  </span>
                </td>
                <td>
                  {r.status === "new" || r.status === "under_review" ? (
                    <div className="flex gap-1">
                      <button data-testid={`shadow-promote-${r.id}`} disabled={pending[r.id]}
                        onClick={() => act(r.id, "promote")}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50">
                        Promote
                      </button>
                      <button data-testid={`shadow-dismiss-${r.id}`} disabled={pending[r.id]}
                        onClick={() => act(r.id, "dismiss")}
                        className="rounded bg-gray-500 px-2 py-1 text-xs text-white disabled:opacity-50">
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
