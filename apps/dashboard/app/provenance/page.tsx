"use client";
import { useState } from "react";
import { authedGet, authedPost } from "@/lib/api";

interface ProvenanceMatch {
  match: boolean;
  public_ref?: string;
  tool_label?: string;
  created_at?: string;
}

export default function Provenance() {
  const [text, setText] = useState("");
  const [id, setId] = useState("");
  const [result, setResult] = useState<ProvenanceMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verifyByText() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const body = await authedPost("/api/v1/provenance/verify", { text });
      setResult(body as ProvenanceMatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setPending(false);
    }
  }

  async function verifyById() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const body = await authedGet(`/api/v1/provenance/verify?id=${encodeURIComponent(id.trim())}`);
      setResult(body as ProvenanceMatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Provenance verification</h1>
      <div className="grid max-w-2xl gap-4">
        <div className="rounded-lg border bg-white p-4">
          <label className="mb-1 block text-sm font-medium">Paste AI-assisted text</label>
          <textarea
            data-testid="provenance-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mb-2 w-full rounded border px-3 py-2 text-sm"
            placeholder="Paste text (with or without the AI-assisted footer)…"
          />
          <button data-testid="provenance-verify-text" onClick={verifyByText} disabled={pending || !text.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
            Verify text
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <label className="mb-1 block text-sm font-medium">Or verify by reference</label>
          <div className="flex gap-2">
            <input
              data-testid="provenance-id-input"
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="PV-2026-000001"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button data-testid="provenance-verify-id" onClick={verifyById} disabled={pending || !id.trim()}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
              Verify ID
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {result && (
          <div data-testid="provenance-result" className="rounded-lg border bg-white p-4">
            {result.match ? (
              <>
                <div className="mb-2 font-medium text-green-800">Match found — this content is AI-assisted.</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-gray-600">
                  <dt>Reference</dt><dd>{result.public_ref}</dd>
                  <dt>Tool</dt><dd>{result.tool_label}</dd>
                  <dt>Recorded</dt><dd>{result.created_at ? new Date(result.created_at).toLocaleString() : "—"}</dd>
                </dl>
              </>
            ) : (
              <div className="text-gray-600">No match. This content is not registered as AI-assisted.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
