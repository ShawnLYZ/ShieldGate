"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPost } from "@/lib/api";
import type { WatchItemRow } from "@/lib/types";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { GradientButton } from "@/components/ui/gradient-button";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  SpinnerIcon,
  TelescopeIcon,
} from "@/components/ui/icons";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

export function WatchList() {
  const [rows, setRows] = useState<WatchItemRow[]>([]);
  const [lastMatrixReview, setLastMatrixReview] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const [{ data: items }, { data: versions }] = await Promise.all([
      supabase.from("watch_items").select("*").order("published_at", { ascending: false, nullsFirst: false }),
      supabase.from("policy_versions").select("bumped_at").order("version", { ascending: false }).limit(1),
    ]);
    setRows((items as WatchItemRow[] | null) ?? []);
    setLastMatrixReview(versions?.[0]?.bumped_at ?? null);
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    setRefreshResult(null);
    try {
      const body = await authedPost("/api/v1/watch/refresh", {});
      setRefreshResult(`${body.new_items} new item(s) found.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const staleCutoff = lastMatrixReview ? new Date(lastMatrixReview).getTime() : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sg-border)] px-4 py-3">
        <GradientButton data-testid="watch-refresh" onClick={refresh} disabled={refreshing} size="sm">
          {refreshing ? <SpinnerIcon size={13} /> : <TelescopeIcon size={13} />}
          {refreshing ? "Refreshing…" : "Refresh feeds"}
        </GradientButton>
        {lastMatrixReview && (
          <span className="text-xs text-[var(--sg-muted)]">
            Matrix last bumped {new Date(lastMatrixReview).toLocaleDateString()}
          </span>
        )}
        {refreshResult && <span className="text-xs text-[var(--sg-allow-text)]">{refreshResult}</span>}
        {error && <ErrorNote className="w-full">{error}</ErrorNote>}
      </div>

      {!loaded ? (
        <Loading />
      ) : (
        <TableScroll>
          <Table>
            <THead>
              <tr><th>Title</th><th>Source</th><th>Tags</th><th>Published</th><th>Status</th></tr>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <EmptyRow colSpan={5}>
                  <EmptyState
                    icon={<TelescopeIcon size={18} />}
                    title="No regulatory watch items yet"
                    description="Configure feeds under Settings, then Refresh."
                  />
                </EmptyRow>
              )}
              {rows.map((r) => {
                const isStale = staleCutoff !== null && r.published_at !== null
                  && new Date(r.published_at).getTime() > staleCutoff;
                return (
                  <Tr key={r.id} data-testid="watch-row">
                    <Td>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[var(--sg-accent-text)] hover:underline"
                      >
                        <span className="max-w-[40ch] truncate">{r.title}</span>
                        <ExternalLinkIcon size={12} className="shrink-0" />
                      </a>
                      {isStale && (
                        <span data-testid="watch-stale-flag" className="ml-2 inline-block align-middle">
                          <Badge tone="warn">
                            <AlertTriangleIcon size={11} />
                            matrix may be stale
                          </Badge>
                        </span>
                      )}
                    </Td>
                    <Td muted>{r.source}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {r.matched_tags.length
                          ? r.matched_tags.map((t) => <Badge key={t}>{t}</Badge>)
                          : <span className="text-[var(--sg-faint)]">—</span>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums" muted>
                      {r.published_at ? new Date(r.published_at).toLocaleDateString() : "—"}
                    </Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
