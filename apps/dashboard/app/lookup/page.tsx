"use client";
import { useState } from "react";
import Link from "next/link";

// Public page: NO Supabase session, NO authedGet/authedPost. Anyone with a
// DR-... reference (e.g. printed on a letter) can look up whether AI was
// involved in a decision about them and file an appeal. Calls the FastAPI
// backend directly with the public NEXT_PUBLIC_BACKEND_URL.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

interface LookupResult {
  public_ref: string;
  system_name: string;
  model_used: string;
  explanation_text: string;
  decided_at: string;
  ai_involved: boolean;
}

export default function Lookup() {
  const [refInput, setRefInput] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const [reason, setReason] = useState("");
  const [appealRef, setAppealRef] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealPending, setAppealPending] = useState(false);

  async function doLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupPending(true);
    setLookupError(null);
    setResult(null);
    setAppealRef(null);
    try {
      const r = await fetch(`${BACKEND}/api/v1/decisions/lookup?ref=${encodeURIComponent(refInput.trim())}`);
      if (r.status === 404) {
        setLookupError("No decision found for that reference. Check the reference and try again.");
        return;
      }
      if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
      setResult((await r.json()) as LookupResult);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupPending(false);
    }
  }

  async function doAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setAppealPending(true);
    setAppealError(null);
    try {
      const r = await fetch(`${BACKEND}/api/v1/decisions/${encodeURIComponent(result.public_ref)}/appeals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!r.ok) throw new Error(`Appeal failed (${r.status})`);
      const body = await r.json();
      setAppealRef(body.public_ref as string);
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : "Appeal failed");
    } finally {
      setAppealPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Was AI involved in a decision about you?</h1>
      <p className="mb-6 text-sm text-gray-600">
        Enter the reference (e.g. <code>DR-2026-000001</code>) printed on your notice to see whether an
        automated system was involved and to file an appeal.
      </p>

      <form onSubmit={doLookup} className="mb-6 flex gap-2">
        <input
          data-testid="lookup-ref-input"
          type="text"
          placeholder="DR-2026-000001"
          value={refInput}
          onChange={(e) => setRefInput(e.target.value)}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button type="submit" disabled={lookupPending || !refInput.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {lookupPending ? "Looking up…" : "Look up"}
        </button>
      </form>

      {lookupError && <div className="mb-6 text-sm text-red-600">{lookupError}</div>}

      {result && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <div className="mb-2 font-medium text-green-800">
            {result.ai_involved ? "Yes — AI was involved in this decision." : "No AI involvement found."}
          </div>
          <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-gray-600">
            <dt>System</dt><dd>{result.system_name} ({result.model_used})</dd>
            <dt>Decided</dt><dd>{new Date(result.decided_at).toLocaleString()}</dd>
          </dl>
          <div data-testid="lookup-explanation" className="rounded bg-gray-50 p-3 text-sm">
            {result.explanation_text}
          </div>

          <form onSubmit={doAppeal} className="mt-4 border-t pt-4">
            <label className="mb-1 block text-sm font-medium">Disagree with this decision? File an appeal.</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you think this decision should be reviewed…"
              className="mb-2 w-full rounded border px-3 py-2 text-sm"
              rows={3}
            />
            <button data-testid="appeal-submit" type="submit" disabled={appealPending || !reason.trim()}
              className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50">
              {appealPending ? "Submitting…" : "Submit appeal"}
            </button>
            {appealError && <div className="mt-2 text-sm text-red-600">{appealError}</div>}
            {appealRef && (
              <div className="mt-3 rounded bg-green-50 p-3 text-sm">
                Appeal filed. Your reference is <span data-testid="appeal-ref" className="font-semibold">{appealRef}</span>.
                {" "}
                <Link href={`/lookup/appeal/${appealRef}`} className="underline">Check its status</Link>.
              </div>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
