"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPatch } from "@/lib/api";
import type { PolicyMatrixCell } from "@/lib/types";

const CATEGORIES: PolicyMatrixCell["data_category"][] = ["public", "internal", "confidential", "restricted"];
const TIERS = [0, 1, 2];
const ACTIONS: PolicyMatrixCell["action"][] = ["allow", "warn", "block"];

const ACTION_STYLE: Record<PolicyMatrixCell["action"], string> = {
  allow: "bg-green-50",
  warn: "bg-amber-50",
  block: "bg-red-50",
};

function key(category: string, tier: number) {
  return `${category}-${tier}`;
}

export function MatrixEditor() {
  const [cells, setCells] = useState<Record<string, PolicyMatrixCell["action"]>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    const { data } = await createClient().from("policy_matrix").select("*");
    const next: Record<string, PolicyMatrixCell["action"]> = {};
    for (const row of (data as PolicyMatrixCell[] | null) ?? []) {
      next[key(row.data_category, row.tier)] = row.action;
    }
    setCells(next);
    setDirty({});
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  function setCell(category: string, tier: number, action: PolicyMatrixCell["action"]) {
    const k = key(category, tier);
    setCells((c) => ({ ...c, [k]: action }));
    setDirty((d) => ({ ...d, [k]: true }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const changed = Object.keys(dirty).filter((k) => dirty[k]);
      const cellPayload = changed.map((k) => {
        const [data_category, tierStr] = k.split("-");
        return { data_category, tier: Number(tierStr), action: cells[k] };
      });
      if (cellPayload.length > 0) {
        await authedPatch("/api/v1/policy-matrix", { cells: cellPayload });
      }
      setDirty({});
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="text-sm text-gray-500">Loading…</div>;

  const anyDirty = Object.values(dirty).some(Boolean);

  return (
    <div>
      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="p-2">Category \ Tier</th>
            {TIERS.map((tier) => <th key={tier}>Tier {tier}</th>)}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat) => (
            <tr key={cat} className="border-t">
              <td className="p-2 font-medium">{cat}</td>
              {TIERS.map((tier) => {
                const k = key(cat, tier);
                const action = cells[k] ?? "allow";
                return (
                  <td key={tier} className={`p-2 ${ACTION_STYLE[action]}`}>
                    <select
                      data-testid={`matrix-cell-${cat}-${tier}`}
                      value={action}
                      onChange={(e) => setCell(cat, tier, e.target.value as PolicyMatrixCell["action"])}
                      className="rounded border px-1 py-0.5 text-xs"
                    >
                      {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button data-testid="matrix-save" onClick={save} disabled={saving || !anyDirty}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save changes"}
      </button>
      {saved && !anyDirty && <span className="ml-2 text-sm text-green-700">Saved. Policy version bumped.</span>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
