"use client";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { ErrorNote, Loading } from "@/components/ui/page";

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

  if (!loaded) return <Loading className="px-0 py-2" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!appeal) return null;

  return (
    <div data-testid="appeal-status">
      <div className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--sg-muted)]">
        Reference <span className="font-mono tracking-normal text-[var(--sg-fg-secondary)]">{appeal.public_ref}</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold text-[var(--sg-fg)]">{STATUS_LABEL[appeal.status]}</span>
        <StatusBadge status={appeal.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-[var(--sg-muted)]">Filed</dt>
        <dd className="text-[var(--sg-fg-secondary)]">{new Date(appeal.created_at).toLocaleString()}</dd>
        {appeal.resolved_at && (
          <>
            <dt className="text-[var(--sg-muted)]">Resolved</dt>
            <dd className="text-[var(--sg-fg-secondary)]">{new Date(appeal.resolved_at).toLocaleString()}</dd>
          </>
        )}
      </dl>
      {appeal.resolution_note && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sg-muted)]">
            Reviewer's note
          </div>
          <div className="rounded-[var(--sg-radius-sm)] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] p-3 text-sm leading-relaxed text-[var(--sg-fg-secondary)]">
            {appeal.resolution_note}
          </div>
        </div>
      )}
    </div>
  );
}
