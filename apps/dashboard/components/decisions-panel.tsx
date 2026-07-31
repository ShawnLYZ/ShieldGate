"use client";
import { useEffect, useState } from "react";
import { authedGet, authedPost } from "@/lib/api";
import type { AppealRow, DecisionRegistrationRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input } from "@/components/ui/field";
import { CheckIcon, ScaleIcon, SpinnerIcon } from "@/components/ui/icons";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

export function DecisionsPanel() {
  const [decisions, setDecisions] = useState<DecisionRegistrationRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      const [d, a] = await Promise.all([
        authedGet("/api/v1/decisions"),
        authedGet("/api/v1/appeals"),
      ]);
      setDecisions(d as DecisionRegistrationRow[]);
      setAppeals(a as AppealRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(appeal: AppealRow) {
    setPending((p) => ({ ...p, [appeal.id]: true }));
    try {
      await authedPost(`/api/v1/appeals/${appeal.id}/resolve`, { note: notes[appeal.id]?.trim() || "Resolved." });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setPending((p) => ({ ...p, [appeal.id]: false }));
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!loaded) return <Loading />;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Decision registrations</CardTitle>
            <CardDescription>Each carries a public reference anyone can look up without an account</CardDescription>
          </div>
        </CardHeader>
        <TableScroll>
          <Table>
            <THead>
              <tr><th>Reference</th><th>System</th><th>Model</th><th>Decided</th></tr>
            </THead>
            <TBody>
              {decisions.length === 0 && (
                <EmptyRow colSpan={4}>
                  <EmptyState
                    icon={<ScaleIcon size={18} />}
                    title="No decisions registered yet"
                    description="Register one via the API and its DR reference becomes publicly resolvable."
                  />
                </EmptyRow>
              )}
              {decisions.map((d) => (
                <Tr key={d.public_ref} data-testid="decision-row">
                  <Td className="whitespace-nowrap font-mono text-xs font-medium text-[var(--sg-fg)]">{d.public_ref}</Td>
                  <Td>{d.system_name}</Td>
                  <Td muted>{d.model_used}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{new Date(d.decided_at).toLocaleString()}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Appeals</CardTitle>
            <CardDescription>Filed by the people a registered decision was made about</CardDescription>
          </div>
        </CardHeader>
        <TableScroll>
          <Table>
            <THead>
              <tr>
                <th>Reference</th><th>Decision</th><th>Reason</th>
                <th>Status</th><th>Filed</th><th>Resolve</th>
              </tr>
            </THead>
            <TBody>
              {appeals.length === 0 && (
                <EmptyRow colSpan={6}>
                  <EmptyState
                    icon={<ScaleIcon size={18} />}
                    title="No appeals filed yet"
                    description="Appeals arrive from the public lookup page."
                  />
                </EmptyRow>
              )}
              {appeals.map((a) => (
                <Tr key={a.id} data-testid="appeal-row">
                  <Td className="whitespace-nowrap font-mono text-xs font-medium text-[var(--sg-fg)]">{a.public_ref}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-[var(--sg-muted)]">{a.decision_ref}</Td>
                  <Td className="max-w-[26ch] truncate" title={a.reason}>{a.reason}</Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td className="whitespace-nowrap tabular-nums">{new Date(a.created_at).toLocaleDateString()}</Td>
                  <Td>
                    {a.status === "resolved" ? (
                      <span className="text-xs text-[var(--sg-muted)]">{a.resolution_note ?? "—"}</span>
                    ) : (
                      <div className="flex w-[176px] flex-col gap-1.5">
                        <Input
                          type="text"
                          placeholder="resolution note"
                          aria-label={`Resolution note for ${a.public_ref}`}
                          value={notes[a.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          className="px-2 py-1 text-[11px]"
                        />
                        <GradientButton
                          data-testid={`resolve-appeal-${a.id}`}
                          disabled={pending[a.id]}
                          onClick={() => resolve(a)}
                          size="sm"
                          variant="success"
                          className="self-start"
                        >
                          {pending[a.id] ? <SpinnerIcon size={12} /> : <CheckIcon size={12} />}
                          Resolve
                        </GradientButton>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </div>
  );
}
