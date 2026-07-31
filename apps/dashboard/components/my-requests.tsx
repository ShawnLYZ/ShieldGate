"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { authedPost } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { ApprovalRequestRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { CheckCircleIcon, InboxIcon, SpinnerIcon } from "@/components/ui/icons";
import { EmptyState, ErrorNote } from "@/components/ui/page";
import { EmptyRow, TBody, THead, Table, TableScroll, Td, Tr } from "@/components/ui/table";

// Self-service page: a signed-in user submits a tool-access request and watches their own
// requests progress. Reads are RLS-scoped (an employee sees only their own rows via the
// current_role()='employee' policy); the submit goes through the JWT-authed backend.
export function MyRequests() {
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [toolName, setToolName] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("approval_requests").select("*").order("created_at", { ascending: false });
    if (data) setRows(data as ApprovalRequestRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSubmitted(false);
    try {
      await authedPost("/api/v1/approvals", {
        tool_name: toolName.trim(),
        tool_url: toolUrl.trim() || null,
        purpose: purpose.trim(),
      });
      setToolName("");
      setToolUrl("");
      setPurpose("");
      setSubmitted(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Request a tool</CardTitle>
            <CardDescription>
              Two reviewers see this — your manager, then an admin. A clear purpose is what moves
              it fastest.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <form data-testid="request-tool-form" onSubmit={submit} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tool name" htmlFor="req-name">
                <Input
                  id="req-name"
                  data-testid="request-tool-name"
                  required
                  placeholder="e.g. Perplexity"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                />
              </Field>
              <Field label="Tool URL" htmlFor="req-url" hint="Optional — helps the reviewer identify the vendor.">
                <Input
                  id="req-url"
                  data-testid="request-tool-url"
                  placeholder="https://…"
                  value={toolUrl}
                  onChange={(e) => setToolUrl(e.target.value)}
                />
              </Field>
            </div>
            <Field label="What do you need it for?" htmlFor="req-purpose">
              <Textarea
                id="req-purpose"
                data-testid="request-purpose"
                required
                placeholder="Describe the task and the kind of data involved."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <GradientButton data-testid="request-submit" type="submit" size="sm" disabled={pending}>
                {pending ? <SpinnerIcon size={13} /> : null}
                {pending ? "Submitting…" : "Submit request"}
              </GradientButton>
              {submitted && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--sg-allow-text)]">
                  <CheckCircleIcon size={14} />
                  Request submitted.
                </span>
              )}
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <TableScroll>
          <Table>
            <THead>
              <tr><th>Tool</th><th>Status</th><th>SLA</th></tr>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <EmptyRow colSpan={3}>
                  <EmptyState
                    icon={<InboxIcon size={18} />}
                    title="No requests yet"
                    description="Anything you ask for above shows up here with its review state."
                  />
                </EmptyRow>
              )}
              {rows.map((r) => (
                <Tr key={r.id} data-testid="my-request-row">
                  <Td>
                    <div className="font-medium text-[var(--sg-fg)]">{r.tool_name}</div>
                    <div className="mt-0.5 max-w-[40ch] text-xs text-[var(--sg-muted)]">{r.purpose}</div>
                  </Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td><StatusBadge status={r.sla_state} /></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </div>
  );
}
