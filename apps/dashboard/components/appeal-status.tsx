"use client";
import { useEffect, useState } from "react";

// Public component: no Supabase session, calls the FastAPI backend directly.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

interface Appeal {
  public_ref: string;
  status: "open" | "in_review" | "resolved";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_LABEL: Record<Appeal["status"], string> = {
  open: "Open — awaiting review",
  in_review: "In review",
  resolved: "Resolved",
};

export function AppealStatus({ appealRef }: { appealRef: string }) {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${BACKEND}/api/v1/appeals/${encodeURIComponent(appealRef)}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("No appeal found for that reference.");
        if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
        return (await r.json()) as Appeal;
      })
      .then((a) => { if (active) setAppeal(a); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Lookup failed"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [appealRef]);

  if (!loaded) return <div className="text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!appeal) return null;

  return (
    <div data-testid="appeal-status">
      <div className="mb-1 text-sm text-gray-500">Reference {appeal.public_ref}</div>
      <div className="mb-3 text-lg font-medium">{STATUS_LABEL[appeal.status]}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-gray-600">
        <dt>Filed</dt><dd>{new Date(appeal.created_at).toLocaleString()}</dd>
        {appeal.resolved_at && <><dt>Resolved</dt><dd>{new Date(appeal.resolved_at).toLocaleString()}</dd></>}
      </dl>
      {appeal.resolution_note && (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm">{appeal.resolution_note}</div>
      )}
    </div>
  );
}
