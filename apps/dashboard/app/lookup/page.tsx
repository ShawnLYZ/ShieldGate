"use client";
import { useState } from "react";
import Link from "next/link";
import { BorderBeamPanel } from "@/components/ui/border-beam-panel";
import { Card, CardBody } from "@/components/ui/card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { ErrorNote } from "@/components/ui/page";
import {
  CheckCircleIcon,
  ExternalLinkIcon,
  InfoIcon,
  ScaleIcon,
  SearchIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

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
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <span className="mb-3 inline-flex size-11 items-center justify-center rounded-[14px] bg-[var(--sg-accent-soft)] text-[var(--sg-accent-text)]">
          <ScaleIcon size={22} />
        </span>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[var(--sg-fg)]">
          Was AI involved in a decision about you?
        </h1>
        <p className="mt-2 text-sm text-[var(--sg-fg-secondary)]">
          Enter the reference printed on your notice — it looks like{" "}
          <code className="rounded bg-[var(--sg-surface-2)] px-1.5 py-0.5 font-mono text-[12px]">
            DR-2026-000001
          </code>{" "}
          — to see whether an automated system was involved, and to file an appeal.
        </p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <form onSubmit={doLookup}>
            <Label htmlFor="lookup-ref">Decision reference</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="lookup-ref"
                data-testid="lookup-ref-input"
                type="text"
                placeholder="DR-2026-000001"
                autoComplete="off"
                spellCheck={false}
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                className="font-mono sm:flex-1"
              />
              <GradientButton
                type="submit"
                size="sm"
                disabled={lookupPending || !refInput.trim()}
                className="h-[38px] shrink-0 px-5 text-sm sm:min-w-[120px]"
              >
                {lookupPending ? <SpinnerIcon size={14} /> : <SearchIcon size={14} />}
                {lookupPending ? "Looking up…" : "Look up"}
              </GradientButton>
            </div>
          </form>
          {lookupError ? (
            <div className="mt-3">
              <ErrorNote>{lookupError}</ErrorNote>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {result && (
        // The beam marks the answer, which is the only thing on this page that
        // matters to the person reading it.
        <BorderBeamPanel
          radius={16}
          idleSpeed={30}
          colors={
            result.ai_involved
              ? ["var(--sg-accent)", "var(--sg-cyan)"]
              : ["var(--sg-muted)", "var(--sg-muted)"]
          }
          className="sg-rise bg-[var(--sg-surface)] p-0"
        >
          <div className="border-b border-[var(--sg-border)] p-5">
            <div className="flex items-start gap-2.5">
              <span
                className={
                  result.ai_involved
                    ? "mt-0.5 text-[var(--sg-allow-text)]"
                    : "mt-0.5 text-[var(--sg-muted)]"
                }
              >
                {result.ai_involved ? <CheckCircleIcon size={18} /> : <InfoIcon size={18} />}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[var(--sg-fg)]">
                  {result.ai_involved
                    ? "Yes — AI was involved in this decision."
                    : "No AI involvement found."}
                </p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-[var(--sg-muted)]">System</dt>
                  <dd className="text-[var(--sg-fg-secondary)]">
                    {result.system_name} ({result.model_used})
                  </dd>
                  <dt className="text-[var(--sg-muted)]">Decided</dt>
                  <dd className="text-[var(--sg-fg-secondary)]">
                    {new Date(result.decided_at).toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sg-muted)]">
                Plain-language explanation
              </div>
              <div
                data-testid="lookup-explanation"
                className="rounded-[var(--sg-radius-sm)] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] p-3 text-sm leading-relaxed text-[var(--sg-fg-secondary)]"
              >
                {result.explanation_text}
              </div>
            </div>
          </div>

          <form onSubmit={doAppeal} className="p-5">
            <Label htmlFor="appeal-reason">
              Disagree with this decision? File an appeal.
            </Label>
            <Textarea
              id="appeal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you think this decision should be reviewed…"
              rows={3}
              className="mb-3"
            />
            <GradientButton
              data-testid="appeal-submit"
              type="submit"
              size="sm"
              variant="neutral"
              disabled={appealPending || !reason.trim()}
              className="h-[36px] px-5 text-sm"
            >
              {appealPending ? <SpinnerIcon size={14} /> : null}
              {appealPending ? "Submitting…" : "Submit appeal"}
            </GradientButton>

            {appealError ? (
              <div className="mt-3">
                <ErrorNote>{appealError}</ErrorNote>
              </div>
            ) : null}

            {appealRef && (
              <div className="mt-3 rounded-[var(--sg-radius-sm)] border border-[color-mix(in_srgb,var(--sg-allow)_38%,transparent)] bg-[var(--sg-allow-soft)] p-3 text-sm text-[var(--sg-allow-text)]">
                Appeal filed. Your reference is{" "}
                <span data-testid="appeal-ref" className="font-mono font-semibold">
                  {appealRef}
                </span>
                .{" "}
                <Link
                  href={`/lookup/appeal/${appealRef}`}
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  Check its status
                  <ExternalLinkIcon size={12} />
                </Link>
              </div>
            )}
          </form>
        </BorderBeamPanel>
      )}
    </main>
  );
}
