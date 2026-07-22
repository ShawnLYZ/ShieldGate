"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPost } from "@/lib/api";
import type { WatchItemRow } from "@/lib/types";

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
      <div className="mb-4 flex items-center gap-2 border-b pb-4">
        <button data-testid="watch-refresh" onClick={refresh} disabled={refreshing}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        {refreshResult && <span className="text-xs text-gray-600">{refreshResult}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No regulatory watch items yet. Configure feeds under Settings, then Refresh.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">Title</th><th>Source</th><th>Tags</th><th>Published</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isStale = staleCutoff !== null && r.published_at !== null
                && new Date(r.published_at).getTime() > staleCutoff;
              return (
                <tr key={r.id} data-testid="watch-row" className="border-t">
                  <td className="p-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                      {r.title}
                    </a>
                    {isStale && (
                      <span data-testid="watch-stale-flag" className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        matrix may be stale
                      </span>
                    )}
                  </td>
                  <td>{r.source}</td>
                  <td>{r.matched_tags.join(", ")}</td>
                  <td>{r.published_at ? new Date(r.published_at).toLocaleDateString() : "—"}</td>
                  <td>{r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
