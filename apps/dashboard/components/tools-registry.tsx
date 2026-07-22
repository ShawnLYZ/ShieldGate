"use client";
import { type FormEvent, useEffect, useState } from "react";
import { authedPatch, authedPost } from "@/lib/api";
import { ContinuityToggle } from "@/components/continuity-toggle";
import { createClient } from "@/lib/supabase";
import type { ToolRow } from "@/lib/types";

const TIERS = [0, 1, 2];

export function ToolsRegistry() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Create-tool form state.
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", vendor: "", domains: "", tier: 0, capability_tags: "", dpa_status: "none" });
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    const { data } = await createClient().from("tools").select("*").order("name");
    setRows((data as ToolRow[] | null) ?? []);
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function saveTier(tool: ToolRow) {
    const next = editingTier[tool.id];
    if (next === undefined || next === tool.tier) return;
    setPending((p) => ({ ...p, [tool.id]: true }));
    setError(null);
    try {
      await authedPatch(`/api/v1/tools/${tool.id}`, { tier: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tier update failed");
    } finally {
      setPending((p) => ({ ...p, [tool.id]: false }));
    }
  }

  async function setFallback(tool: ToolRow, fallbackId: string) {
    setPending((p) => ({ ...p, [tool.id]: true }));
    setError(null);
    try {
      await authedPatch(`/api/v1/tools/${tool.id}`, { fallback_tool_id: fallbackId || null });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fallback update failed");
    } finally {
      setPending((p) => ({ ...p, [tool.id]: false }));
    }
  }

  async function createTool(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await authedPost("/api/v1/tools", {
        name: form.name.trim(),
        vendor: form.vendor.trim(),
        domains: form.domains.split(",").map((d) => d.trim()).filter(Boolean),
        tier: form.tier,
        capability_tags: form.capability_tags.split(",").map((t) => t.trim()).filter(Boolean),
        dpa_status: form.dpa_status.trim() || "none",
      });
      setForm({ name: "", vendor: "", domains: "", tier: 0, capability_tags: "", dpa_status: "none" });
      setCreating(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    }
  }

  if (!loaded) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <div className="mb-4">
        {!creating ? (
          <button data-testid="tool-create-open" onClick={() => setCreating(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white">Add tool</button>
        ) : (
          <form data-testid="tool-create-form" onSubmit={createTool}
            className="flex flex-wrap items-end gap-2 rounded border bg-gray-50 p-3">
            <input data-testid="tool-create-name" required placeholder="Name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded border px-2 py-1 text-xs" />
            <input required placeholder="Vendor" value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              className="rounded border px-2 py-1 text-xs" />
            <input data-testid="tool-create-domains" placeholder="domains (comma-separated)" value={form.domains}
              onChange={(e) => setForm((f) => ({ ...f, domains: e.target.value }))}
              className="rounded border px-2 py-1 text-xs" />
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: Number(e.target.value) }))}
              className="rounded border px-1 py-1 text-xs">
              {TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
            <input placeholder="capabilities (comma-separated)" value={form.capability_tags}
              onChange={(e) => setForm((f) => ({ ...f, capability_tags: e.target.value }))}
              className="rounded border px-2 py-1 text-xs" />
            <button data-testid="tool-create-submit" type="submit"
              className="rounded bg-green-600 px-3 py-1 text-xs text-white">Create</button>
            <button type="button" onClick={() => setCreating(false)}
              className="text-xs text-gray-500 underline">cancel</button>
            {createError && <div className="w-full text-xs text-red-600">{createError}</div>}
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">No tools registered.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">Name</th><th>Vendor</th><th>Domains</th>
              <th>Tier</th><th>DPA</th><th>Fallback</th><th>Continuity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} data-testid="tool-row" className="border-t align-top">
                <td className="p-2 font-medium">{t.name}</td>
                <td>{t.vendor}</td>
                <td className="max-w-xs truncate">{t.domains.join(", ")}</td>
                <td>
                  <select
                    data-testid={`tool-tier-${t.id}`}
                    value={editingTier[t.id] ?? t.tier}
                    onChange={(e) => setEditingTier((m) => ({ ...m, [t.id]: Number(e.target.value) }))}
                    className="rounded border px-1 py-0.5 text-xs"
                  >
                    {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                  </select>
                  {(editingTier[t.id] ?? t.tier) !== t.tier && (
                    <button data-testid={`tool-tier-save-${t.id}`} disabled={pending[t.id]}
                      onClick={() => saveTier(t)}
                      className="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white disabled:opacity-50">
                      Save
                    </button>
                  )}
                </td>
                <td>{t.dpa_status}</td>
                <td>
                  <select
                    data-testid={`tool-fallback-${t.id}`}
                    value={t.fallback_tool_id ?? ""}
                    disabled={pending[t.id]}
                    onChange={(e) => setFallback(t, e.target.value)}
                    className="rounded border px-1 py-0.5 text-xs"
                  >
                    <option value="">None</option>
                    {rows.filter((o) => o.id !== t.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.name} (T{o.tier})</option>
                    ))}
                  </select>
                </td>
                <td><ContinuityToggle toolId={t.id} status={t.continuity_status} onChanged={load} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
