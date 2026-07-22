"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { authedPost } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { ApprovalRequestRow } from "@/lib/types";

// Self-service page: a signed-in user submits a tool-access request and watches their own
// requests progress. Reads are RLS-scoped (an employee sees only their own rows via the
// current_role()='employee' policy); the submit goes through the JWT-authed backend.
export function MyRequests() {
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [toolName, setToolName] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("approval_requests").select("*").order("created_at", { ascending: false });
    if (data) setRows(data as ApprovalRequestRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSubmitted(false);
    try {
      await authedPost("/api/v1/approvals", {
        tool_name: toolName.trim(),
        tool_url: toolUrl.trim() || null,
        purpose: purpose.trim(),
      });
      setToolName("");
      setToolUrl("");
      setPurpose("");
      setSubmitted(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form data-testid="request-tool-form" onSubmit={submit} className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-lg font-medium">Request a tool</h2>
        <div className="flex flex-col gap-2">
          <input data-testid="request-tool-name" required placeholder="Tool name (e.g. Perplexity)"
            value={toolName} onChange={(e) => setToolName(e.target.value)}
            className="rounded border px-3 py-2 text-sm" />
          <input data-testid="request-tool-url" placeholder="Tool URL (optional)"
            value={toolUrl} onChange={(e) => setToolUrl(e.target.value)}
            className="rounded border px-3 py-2 text-sm" />
          <textarea data-testid="request-purpose" required placeholder="What do you need it for?"
            value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}
            className="rounded border px-3 py-2 text-sm" />
          <div>
            <button data-testid="request-submit" type="submit" disabled={pending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {pending ? "Submitting…" : "Submit request"}
            </button>
            {submitted && <span className="ml-2 text-sm text-green-700">Request submitted.</span>}
            {error && <span className="ml-2 text-sm text-red-600">{error}</span>}
          </div>
        </div>
      </form>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-lg font-medium">My requests</h2>
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500">No requests yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500"><th className="p-2">Tool</th><th>Status</th><th>SLA</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="my-request-row" className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{r.tool_name}</div>
                    <div className="text-xs text-gray-500">{r.purpose}</div>
                  </td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.sla_state.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
