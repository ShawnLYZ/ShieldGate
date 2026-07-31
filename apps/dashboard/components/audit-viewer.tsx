"use client";
import { useEffect, useState } from "react";
import { authedGet, getAccessToken } from "@/lib/api";
import type { IncidentRow } from "@/lib/types";
import { VerdictBadge } from "@/components/ui/badge";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input } from "@/components/ui/field";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  LinkChainIcon,
  SearchIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

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
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--sg-border)] px-4 py-3">
        <form
          className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"
          onSubmit={(e) => { e.preventDefault(); load(eventType); }}
        >
          <Input
            type="text"
            placeholder="Filter by event_type (e.g. output_flag)"
            aria-label="Filter by event type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="min-w-0 flex-1 px-2.5 py-1.5 text-xs"
          />
          <GradientButton type="submit" size="sm" variant="neutral">
            <SearchIcon size={13} />
            Apply
          </GradientButton>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <GradientButton data-testid="audit-export-csv" onClick={exportCsv} disabled={exportPending} size="sm" variant="ghost">
            {exportPending ? <SpinnerIcon size={13} /> : <DownloadIcon size={13} />}
            {exportPending ? "Exporting…" : "Export CSV"}
          </GradientButton>
          <GradientButton data-testid="audit-verify-chain" onClick={verifyChain} disabled={verifyPending} size="sm">
            {verifyPending ? <SpinnerIcon size={13} /> : <LinkChainIcon size={13} />}
            {verifyPending ? "Verifying…" : "Verify chain"}
          </GradientButton>
          {verifyResult && (
            // A tamper result is the single most consequential thing this page
            // can say, so it gets a glyph and a word, not just a colour.
            <span
              data-testid="verify-result"
              className={
                verifyResult.ok
                  ? "flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sg-allow)_42%,transparent)] bg-[var(--sg-allow-soft)] px-2.5 py-1 text-xs font-medium text-[var(--sg-allow-text)]"
                  : "flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sg-block)_42%,transparent)] bg-[var(--sg-block-soft)] px-2.5 py-1 text-xs font-medium text-[var(--sg-block-text)]"
              }
            >
              {verifyResult.ok ? <CheckCircleIcon size={13} /> : <AlertTriangleIcon size={13} />}
              {verifyResult.ok
                ? "Chain intact"
                : `Tampered — first bad seq ${verifyResult.first_bad_seq}`}
            </span>
          )}
        </div>
      </div>

      {error && <div className="px-4 pt-3"><ErrorNote>{error}</ErrorNote></div>}

      {!loaded ? (
        <Loading />
      ) : (
        <TableScroll>
          <Table>
            <THead>
              <tr>
                <th>Seq</th><th>Time</th><th>Dept</th><th>Tool</th>
                <th>Type</th><th>Category</th><th>Action</th><th>Excerpt</th>
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <EmptyRow colSpan={8}>
                  <EmptyState
                    icon={<LinkChainIcon size={18} />}
                    title="No audit events match this filter"
                    description="Clear the event_type filter to see the whole chain."
                  />
                </EmptyRow>
              )}
              {rows.map((r) => (
                <Tr key={r.seq} data-testid="audit-row">
                  <Td numeric className="font-mono text-xs text-[var(--sg-muted)]">{r.seq}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{new Date(r.created_at).toLocaleString()}</Td>
                  <Td muted>{r.department ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{r.tool_domain ?? "—"}</Td>
                  <Td>{r.event_type}</Td>
                  <Td muted>{r.data_category ?? "—"}</Td>
                  <Td><VerdictBadge action={r.matrix_action} /></Td>
                  <Td className="max-w-[24ch] truncate text-[var(--sg-muted)]">{r.masked_excerpt ?? "—"}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
