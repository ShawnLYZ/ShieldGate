"use client";
import { type FormEvent, useEffect, useState } from "react";
import { authedPatch, authedPost } from "@/lib/api";
import { ContinuityToggle } from "@/components/continuity-toggle";
import { createClient } from "@/lib/supabase";
import type { ToolRow } from "@/lib/types";
import { Badge, TierBadge } from "@/components/ui/badge";
import { GradientButton } from "@/components/ui/gradient-button";
import { Field, Input, Select } from "@/components/ui/field";
import { CheckIcon, PackageIcon } from "@/components/ui/icons";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

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

  if (!loaded) return <Loading />;

  return (
    <div>
      <div className="border-b border-[var(--sg-border)] px-4 py-3">
        {!creating ? (
          <GradientButton data-testid="tool-create-open" onClick={() => setCreating(true)} size="sm">
            Add tool
          </GradientButton>
        ) : (
          <form
            data-testid="tool-create-form"
            onSubmit={createTool}
            className="rounded-[var(--sg-radius)] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" htmlFor="tool-name">
                <Input id="tool-name" data-testid="tool-create-name" required placeholder="e.g. Perplexity"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs" />
              </Field>
              <Field label="Vendor" htmlFor="tool-vendor">
                <Input id="tool-vendor" required placeholder="e.g. Perplexity AI"
                  value={form.vendor}
                  onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs" />
              </Field>
              <Field label="Domains" htmlFor="tool-domains" hint="Comma-separated hostnames.">
                <Input id="tool-domains" data-testid="tool-create-domains" placeholder="perplexity.ai, www.perplexity.ai"
                  value={form.domains}
                  onChange={(e) => setForm((f) => ({ ...f, domains: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs" />
              </Field>
              <Field label="Tier" htmlFor="tool-tier">
                <Select id="tool-tier" value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: Number(e.target.value) }))}
                  className="px-2.5 py-1.5 text-xs">
                  {TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
                </Select>
              </Field>
              <Field label="Capabilities" htmlFor="tool-caps" hint="Comma-separated tags.">
                <Input id="tool-caps" placeholder="chat, code, vision"
                  value={form.capability_tags}
                  onChange={(e) => setForm((f) => ({ ...f, capability_tags: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs" />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <GradientButton data-testid="tool-create-submit" type="submit" size="sm" variant="success">
                <CheckIcon size={12} />
                Create
              </GradientButton>
              <GradientButton type="button" onClick={() => setCreating(false)} size="sm" variant="ghost">
                Cancel
              </GradientButton>
            </div>
            {createError && <div className="mt-2"><ErrorNote>{createError}</ErrorNote></div>}
          </form>
        )}
      </div>

      {error && <div className="px-4 pt-3"><ErrorNote>{error}</ErrorNote></div>}

      <TableScroll>
        <Table>
          <THead>
            <tr>
              <th>Name</th><th>Vendor</th><th>Domains</th>
              <th>Tier</th><th>DPA</th><th>Fallback</th><th>Continuity</th>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>
                <EmptyState
                  icon={<PackageIcon size={18} />}
                  title="No tools registered"
                  description="Anything not registered here is enforced as Tier 0 at the point of use."
                />
              </EmptyRow>
            )}
            {rows.map((t) => (
              <Tr key={t.id} data-testid="tool-row">
                <Td>
                  <div className="font-medium text-[var(--sg-fg)]">{t.name}</div>
                  {t.capability_tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.capability_tags.map((c) => <Badge key={c}>{c}</Badge>)}
                    </div>
                  )}
                </Td>
                <Td muted>{t.vendor}</Td>
                <Td className="max-w-[22ch] truncate font-mono text-xs" title={t.domains.join(", ")}>
                  {t.domains.join(", ")}
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Select
                      data-testid={`tool-tier-${t.id}`}
                      aria-label={`Tier for ${t.name}`}
                      value={editingTier[t.id] ?? t.tier}
                      onChange={(e) => setEditingTier((m) => ({ ...m, [t.id]: Number(e.target.value) }))}
                      className="w-[64px] px-2 py-1 text-xs"
                    >
                      {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </Select>
                    {(editingTier[t.id] ?? t.tier) !== t.tier ? (
                      <GradientButton data-testid={`tool-tier-save-${t.id}`} disabled={pending[t.id]}
                        onClick={() => saveTier(t)} size="sm" className="px-2 py-1">
                        Save
                      </GradientButton>
                    ) : (
                      <TierBadge tier={t.tier} short />
                    )}
                  </div>
                </Td>
                <Td muted>{t.dpa_status}</Td>
                <Td>
                  <Select
                    data-testid={`tool-fallback-${t.id}`}
                    aria-label={`Fallback tool for ${t.name}`}
                    value={t.fallback_tool_id ?? ""}
                    disabled={pending[t.id]}
                    onChange={(e) => setFallback(t, e.target.value)}
                    className="w-[150px] px-2 py-1 text-xs"
                  >
                    <option value="">None</option>
                    {rows.filter((o) => o.id !== t.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.name} (T{o.tier})</option>
                    ))}
                  </Select>
                </Td>
                <Td><ContinuityToggle toolId={t.id} status={t.continuity_status} onChanged={load} /></Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </div>
  );
}
