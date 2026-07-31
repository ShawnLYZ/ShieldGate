"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authedPatch } from "@/lib/api";
import type { PolicyMatrixCell } from "@/lib/types";
import { GradientButton } from "@/components/ui/gradient-button";
import { Select } from "@/components/ui/field";
import { CheckCircleIcon, SpinnerIcon } from "@/components/ui/icons";
import { ErrorNote, Loading } from "@/components/ui/page";
import { TableScroll } from "@/components/ui/table";

const CATEGORIES: PolicyMatrixCell["data_category"][] = ["public", "internal", "confidential", "restricted"];
const TIERS = [0, 1, 2];
const ACTIONS: PolicyMatrixCell["action"][] = ["allow", "warn", "block"];

const TIER_LABEL: Record<number, string> = {
  0: "unapproved",
  1: "restricted",
  2: "enterprise",
};

// The cell tint is the whole point of rendering this as a grid rather than a
// list: an admin should be able to see the shape of the policy — where the
// blocks cluster — before reading a single word. The select inside still names
// the action, so the tint is reinforcement, never the only signal.
const CELL_STYLE: Record<PolicyMatrixCell["action"], string> = {
  allow: "border-[color-mix(in_srgb,var(--sg-allow)_35%,transparent)] bg-[var(--sg-allow-soft)]",
  warn: "border-[color-mix(in_srgb,var(--sg-warn)_35%,transparent)] bg-[var(--sg-warn-soft)]",
  block: "border-[color-mix(in_srgb,var(--sg-block)_35%,transparent)] bg-[var(--sg-block-soft)]",
};

const DOT_STYLE: Record<PolicyMatrixCell["action"], string> = {
  allow: "bg-[var(--sg-allow)]",
  warn: "bg-[var(--sg-warn)]",
  block: "bg-[var(--sg-block)]",
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

  if (!loaded) return <Loading />;

  const anyDirty = Object.values(dirty).some(Boolean);
  const dirtyCount = Object.values(dirty).filter(Boolean).length;

  return (
    <div>
      <TableScroll className="p-4">
        <table className="w-full border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-[130px] px-2 pb-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-muted)]">
                Category \ Tier
              </th>
              {TIERS.map((tier) => (
                <th key={tier} className="px-2 pb-1 text-left">
                  <div className="text-[13px] font-semibold text-[var(--sg-fg)]">Tier {tier}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--sg-faint)]">
                    {TIER_LABEL[tier]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <tr key={cat}>
                <td className="px-2 text-[13px] font-medium capitalize text-[var(--sg-fg)]">{cat}</td>
                {TIERS.map((tier) => {
                  const k = key(cat, tier);
                  const action = cells[k] ?? "allow";
                  const isDirty = !!dirty[k];
                  return (
                    <td key={tier} className="min-w-[136px]">
                      <div
                        className={`relative rounded-[var(--sg-radius-sm)] border p-2 transition-colors duration-200 ${CELL_STYLE[action]}`}
                      >
                        {isDirty && (
                          <span
                            aria-hidden="true"
                            title="Unsaved change"
                            className="absolute -right-1 -top-1 size-2 rounded-full bg-[var(--sg-accent)] ring-2 ring-[var(--sg-surface)]"
                          />
                        )}
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium capitalize text-[var(--sg-fg)]">
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT_STYLE[action]}`} />
                          {action}
                        </div>
                        <Select
                          data-testid={`matrix-cell-${cat}-${tier}`}
                          aria-label={`Action for ${cat} data on a Tier ${tier} tool`}
                          value={action}
                          onChange={(e) => setCell(cat, tier, e.target.value as PolicyMatrixCell["action"])}
                          className="bg-[var(--sg-surface)] px-2 py-1 text-xs"
                        >
                          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </Select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--sg-border)] px-4 py-3">
        <GradientButton data-testid="matrix-save" onClick={save} size="sm" disabled={saving || !anyDirty}>
          {saving ? <SpinnerIcon size={13} /> : null}
          {saving ? "Saving…" : "Save changes"}
        </GradientButton>
        {anyDirty && !saving && (
          <span className="text-xs text-[var(--sg-muted)]">
            {dirtyCount} unsaved {dirtyCount === 1 ? "cell" : "cells"}
          </span>
        )}
        {saved && !anyDirty && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--sg-allow-text)]">
            <CheckCircleIcon size={14} />
            Saved. Policy version bumped.
          </span>
        )}
        {error && <ErrorNote className="w-full">{error}</ErrorNote>}
      </div>
    </div>
  );
}
