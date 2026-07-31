"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPost, getAccessToken } from "@/lib/api";
import type { ShadowCandidateRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { GradientButton } from "@/components/ui/gradient-button";
import { CheckIcon, RadarIcon, SpinnerIcon, XIcon } from "@/components/ui/icons";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

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
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sg-border)] px-4 py-3">
        <label className="min-w-0 flex-1 sm:max-w-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--sg-fg-secondary)]">
            Identity-provider export (CSV)
          </span>
          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            data-testid="shadow-import-input"
            className="w-full cursor-pointer text-xs text-[var(--sg-muted)] file:mr-3 file:cursor-pointer file:rounded-[8px] file:border file:border-[var(--sg-border-strong)] file:bg-[var(--sg-surface-2)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--sg-fg)] hover:file:bg-[var(--sg-surface-3)]"
          />
        </label>
        <GradientButton
          onClick={importCsv}
          disabled={importPending}
          data-testid="shadow-import-submit"
          size="sm"
          className="mt-4"
        >
          {importPending ? <SpinnerIcon size={13} /> : null}
          {importPending ? "Importing…" : "Import IdP CSV"}
        </GradientButton>
        {importResult && (
          <span className="text-xs text-[var(--sg-muted)]">{importResult}</span>
        )}
      </div>

      {error && <div className="px-4 pt-3"><ErrorNote>{error}</ErrorNote></div>}

      {!loaded ? (
        <Loading />
      ) : (
        <TableScroll>
          <Table>
            <THead>
              <tr>
                <th>Domain</th><th>Source</th><th>Users</th>
                <th>First seen</th><th>Last seen</th><th>Status</th><th>Actions</th>
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <EmptyRow colSpan={7}>
                  <EmptyState
                    icon={<RadarIcon size={18} />}
                    title="No shadow AI candidates found"
                    description="Import an identity-provider log above to discover AI domains that are in use but not in the tool registry."
                  />
                </EmptyRow>
              )}
              {rows.map((r) => (
                <Tr key={r.id} data-testid="shadow-row">
                  <Td className="whitespace-nowrap font-medium text-[var(--sg-fg)]">{r.domain}</Td>
                  <Td muted>{r.source}</Td>
                  <Td numeric>{r.user_count}</Td>
                  <Td className="whitespace-nowrap tabular-nums" muted>{r.first_seen}</Td>
                  <Td className="whitespace-nowrap tabular-nums" muted>{r.last_seen}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>
                    {r.status === "new" || r.status === "under_review" ? (
                      <div className="flex gap-1">
                        <GradientButton data-testid={`shadow-promote-${r.id}`} disabled={pending[r.id]}
                          onClick={() => act(r.id, "promote")} size="sm" variant="success">
                          <CheckIcon size={12} />
                          Promote
                        </GradientButton>
                        <GradientButton data-testid={`shadow-dismiss-${r.id}`} disabled={pending[r.id]}
                          onClick={() => act(r.id, "dismiss")} size="sm" variant="neutral">
                          <XIcon size={12} />
                          Dismiss
                        </GradientButton>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--sg-faint)]">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
