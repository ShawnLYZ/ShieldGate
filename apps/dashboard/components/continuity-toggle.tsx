"use client";
import { useState } from "react";
import { authedPost } from "@/lib/api";
import type { ToolRow } from "@/lib/types";

const STATUSES: ToolRow["continuity_status"][] = ["active", "advisory", "suspended"];

const STATUS_BADGE: Record<ToolRow["continuity_status"], string> = {
  active: "bg-green-100 text-green-800",
  advisory: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

export function ContinuityToggle({ toolId, status, onChanged }: {
  toolId: string; status: ToolRow["continuity_status"]; onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function setStatus(next: ToolRow["continuity_status"]) {
    setPending(true);
    setError(null);
    try {
      await authedPost(`/api/v1/tools/${toolId}/continuity`, { status: next, note: note.trim() || null });
      setEditing(false);
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid={`continuity-toggle-${toolId}`}>
      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[status]}`}>{status}</span>
      {!editing ? (
        <button onClick={() => setEditing(true)} className="ml-2 text-xs text-blue-700 underline">
          Change
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          <input type="text" placeholder="note (optional)" value={note}
            onChange={(e) => setNote(e.target.value)} className="w-36 rounded border px-1 py-0.5 text-xs" />
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button key={s} data-testid={`continuity-set-${toolId}-${s}`} disabled={pending || s === status}
                onClick={() => setStatus(s)}
                className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white disabled:opacity-40">
                {s}
              </button>
            ))}
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 underline">cancel</button>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
