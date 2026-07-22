"use client";
import { useEffect, useState } from "react";
import { ApiError, authedGet, authedPatch } from "@/lib/api";

export function SettingsEditor({ settingKey, title }: { settingKey: string; title: string }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    authedGet(`/api/v1/settings/${settingKey}`)
      .then((body) => { if (active) setText(JSON.stringify(body.value, null, 2)); })
      .catch((err) => {
        if (!active) return;
        // Only a 404 means "no setting stored yet" -- safe to start from {}. Any other
        // error (500/network) must NOT collapse to {}, or a blind Save would overwrite
        // the real cost_model/risk_weights with an empty object. Block saving instead.
        if (err instanceof ApiError && err.status === 404) {
          setText("{}");
        } else {
          setLoadError(err instanceof Error ? err.message : "Failed to load setting");
        }
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [settingKey]);

  async function save() {
    setError(null);
    setSaved(false);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setError("Invalid JSON.");
      return;
    }
    setSaving(true);
    try {
      await authedPatch(`/api/v1/settings/${settingKey}`, { value });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      {!loaded ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : loadError ? (
        <div data-testid={`settings-load-error-${settingKey}`} className="text-sm text-red-600">
          Could not load this setting ({loadError}). Editing is disabled to avoid overwriting
          the stored value — reload once the backend is reachable.
        </div>
      ) : (
        <>
          <textarea
            data-testid={`settings-${settingKey}`}
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false); }}
            rows={8}
            spellCheck={false}
            className="mb-2 w-full rounded border px-3 py-2 font-mono text-xs"
          />
          <button data-testid={`settings-save-${settingKey}`} onClick={save} disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="ml-2 text-sm text-green-700">Saved.</span>}
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </>
      )}
    </div>
  );
}
