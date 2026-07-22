"use client";
import { useEffect, useState } from "react";
import { authedGet, getAccessToken } from "@/lib/api";
import type { IncidentRow } from "@/lib/types";

interface VerifyResult { ok: boolean; first_bad_seq: number | null }

export function AuditViewer() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");

  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyPending, setVerifyPending] = useState(false);
  const [exportPending, setExportPending] = useState(false);

  async function load(filterEventType: string) {
    setLoaded(false);
    setError(null);
    try {
      const qs = filterEventType ? `?event_type=${encodeURIComponent(filterEventType)}` : "";
      const body = await authedGet(`/api/v1/audit${qs}`);
      setRows((body.items as IncidentRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(""); }, []);

  async function verifyChain() {
    setVerifyPending(true);
    setVerifyResult(null);
    try {
      const body = await authedGet("/api/v1/audit/verify");
      setVerifyResult(body as VerifyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyPending(false);
    }
  }

  async function exportCsv() {
    setExportPending(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const base = process.env.NEXT_PUBLIC_BACKEND_URL!;
      const r = await fetch(`${base}/api/v1/audit/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Export failed (${r.status})`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shieldgate-audit.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportPending(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
        <input
          type="text"
          placeholder="Filter by event_type (e.g. output_flag)"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
        <button onClick={() => load(eventType)} className="rounded bg-gray-800 px-3 py-1.5 text-xs text-white">
          Apply filter
        </button>
        <button data-testid="audit-export-csv" onClick={exportCsv} disabled={exportPending}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {exportPending ? "Exporting…" : "Export CSV"}
        </button>
        <button data-testid="audit-verify-chain" onClick={verifyChain} disabled={verifyPending}
          className="rounded bg-gray-800 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {verifyPending ? "Verifying…" : "Verify chain"}
        </button>
        {verifyResult && (
          <span data-testid="verify-result" className={verifyResult.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
            {verifyResult.ok
              ? "✓ Chain intact"
              : `✗ Tampered — first bad seq ${verifyResult.first_bad_seq}`}
          </span>
        )}
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No audit events match this filter.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">Seq</th><th>Time</th><th>Dept</th><th>Tool</th>
              <th>Type</th><th>Category</th><th>Action</th><th>Excerpt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq} data-testid="audit-row" className="border-t">
                <td className="p-2">{r.seq}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.department ?? "—"}</td>
                <td>{r.tool_domain ?? "—"}</td>
                <td>{r.event_type}</td>
                <td>{r.data_category ?? "—"}</td>
                <td>{r.matrix_action ?? "—"}</td>
                <td className="max-w-xs truncate">{r.masked_excerpt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
