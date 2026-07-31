"use client";
import { useState } from "react";
import { authedGet, authedPost } from "@/lib/api";
import { BorderBeamPanel } from "@/components/ui/border-beam-panel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { ErrorNote, PageHeader, PageShell } from "@/components/ui/page";
import {
  CheckCircleIcon,
  FingerprintIcon,
  InfoIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

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
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow="Evidence"
        title="Provenance verification"
        description="Content copied out of an AI tool carries a footer with a PV reference. Verification matches on a sha256 of the text — the original content was never stored, so a match proves registration without holding the words."
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Verify by content</CardTitle>
          </CardHeader>
          <CardBody>
            <Label htmlFor="pv-text">Paste AI-assisted text</Label>
            <Textarea
              id="pv-text"
              data-testid="provenance-text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mb-3"
              placeholder="Paste text (with or without the AI-assisted footer)…"
            />
            <GradientButton
              data-testid="provenance-verify-text"
              onClick={verifyByText}
              size="sm"
              disabled={pending || !text.trim()}
            >
              {pending ? <SpinnerIcon size={13} /> : <FingerprintIcon size={13} />}
              Verify text
            </GradientButton>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verify by reference</CardTitle>
          </CardHeader>
          <CardBody>
            <Label htmlFor="pv-id">PV reference</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="pv-id"
                data-testid="provenance-id-input"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="PV-2026-000001"
                spellCheck={false}
                className="font-mono sm:flex-1"
              />
              <GradientButton
                data-testid="provenance-verify-id"
                onClick={verifyById}
                size="sm"
                variant="neutral"
                disabled={pending || !id.trim()}
                className="h-[38px] shrink-0 px-5"
              >
                {pending ? <SpinnerIcon size={13} /> : null}
                Verify ID
              </GradientButton>
            </div>
          </CardBody>
        </Card>

        <ErrorNote>{error}</ErrorNote>

        {result && (
          <BorderBeamPanel
            radius={16}
            idleSpeed={30}
            colors={
              result.match
                ? ["var(--sg-allow)", "var(--sg-cyan)"]
                : ["var(--sg-muted)", "var(--sg-muted)"]
            }
            className="sg-rise bg-[var(--sg-surface)] p-5"
          >
            <div data-testid="provenance-result">
              {result.match ? (
                <>
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--sg-allow-text)]">
                    <CheckCircleIcon size={17} />
                    Match found — this content is AI-assisted.
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-[var(--sg-muted)]">Reference</dt>
                    <dd className="font-mono text-[var(--sg-fg)]">{result.public_ref}</dd>
                    <dt className="text-[var(--sg-muted)]">Tool</dt>
                    <dd className="text-[var(--sg-fg-secondary)]">{result.tool_label}</dd>
                    <dt className="text-[var(--sg-muted)]">Recorded</dt>
                    <dd className="text-[var(--sg-fg-secondary)]">
                      {result.created_at ? new Date(result.created_at).toLocaleString() : "—"}
                    </dd>
                  </dl>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--sg-fg-secondary)]">
                  <InfoIcon size={16} className="text-[var(--sg-muted)]" />
                  No match. This content is not registered as AI-assisted.
                </div>
              )}
            </div>
          </BorderBeamPanel>
        )}
      </div>
    </PageShell>
  );
}
