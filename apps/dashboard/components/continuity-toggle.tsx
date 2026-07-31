"use client";
import { useState } from "react";
import { authedPost } from "@/lib/api";
import type { ToolRow } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/beam-dialog";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input } from "@/components/ui/field";
import { ErrorNote } from "@/components/ui/page";

const STATUSES: ToolRow["continuity_status"][] = ["active", "advisory", "suspended"];

const STATUS_HELP: Record<ToolRow["continuity_status"], string> = {
  active: "Enforced at its registered tier.",
  advisory: "Still usable; employees see a caution.",
  suspended: "Enforced as Tier 0 at the point of use, whatever tier it is registered at.",
};

export function ContinuityToggle({ toolId, status, onChanged }: {
  toolId: string; status: ToolRow["continuity_status"]; onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function setStatus(next: ToolRow["continuity_status"]) {
    setPending(true);
    setError(null);
    try {
      await authedPost(`/api/v1/tools/${toolId}/continuity`, { status: next, note: note.trim() || null });
      setEditing(false);
      setConfirming(false);
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  // Suspension is the one status change that immediately degrades every
  // employee's access to the tool org-wide, so it gets a confirm step; active
  // and advisory apply straight away.
  function request(next: ToolRow["continuity_status"]) {
    if (next === "suspended") setConfirming(true);
    else void setStatus(next);
  }

  return (
    <div data-testid={`continuity-toggle-${toolId}`} className="min-w-[150px]">
      <div className="flex items-center gap-1.5">
        <StatusBadge status={status} />
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="cursor-pointer text-[11px] font-medium text-[var(--sg-accent-text)] underline underline-offset-2 hover:text-[var(--sg-accent)]"
          >
            Change
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <Input
            type="text"
            placeholder="note (optional)"
            aria-label="Continuity change note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="px-2 py-1 text-[11px]"
          />
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <GradientButton
                key={s}
                data-testid={`continuity-set-${toolId}-${s}`}
                disabled={pending || s === status}
                onClick={() => request(s)}
                size="sm"
                variant={s === "suspended" ? "variant" : "neutral"}
                title={STATUS_HELP[s]}
                className="px-2 py-1 text-[11px]"
              >
                {s}
              </GradientButton>
            ))}
            <button
              onClick={() => setEditing(false)}
              className="cursor-pointer px-1 text-[11px] text-[var(--sg-muted)] underline underline-offset-2 hover:text-[var(--sg-fg)]"
            >
              cancel
            </button>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => setStatus("suspended")}
        tone="block"
        title="Suspend this tool?"
        description="Every employee hits Tier 0 policy on this tool from their next prompt onward."
        confirmLabel="Suspend tool"
        pending={pending}
      >
        <p className="text-[var(--sg-fg-secondary)]">
          The tool keeps its registered tier — suspension is an availability fact, not a risk
          re-assessment, so lifting it later restores the original tier with no re-approval.
        </p>
        {note.trim() ? (
          <p className="mt-3 rounded-[var(--sg-radius-sm)] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] p-2 text-xs text-[var(--sg-muted)]">
            Note recorded with this change: <span className="text-[var(--sg-fg-secondary)]">{note.trim()}</span>
          </p>
        ) : null}
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </ConfirmDialog>
    </div>
  );
}
