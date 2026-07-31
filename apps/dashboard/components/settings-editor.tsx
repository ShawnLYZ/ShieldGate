"use client";
import { useEffect, useState } from "react";
import { ApiError, authedGet, authedPatch } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Textarea } from "@/components/ui/field";
import { CheckCircleIcon, SpinnerIcon } from "@/components/ui/icons";
import { ErrorNote, Loading } from "@/components/ui/page";

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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <code className="rounded bg-[var(--sg-surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--sg-muted)]">
          {settingKey}
        </code>
      </CardHeader>
      {!loaded ? (
        <Loading />
      ) : loadError ? (
        <CardBody>
          <div data-testid={`settings-load-error-${settingKey}`}>
            <ErrorNote>
              Could not load this setting ({loadError}). Editing is disabled to avoid overwriting
              the stored value — reload once the backend is reachable.
            </ErrorNote>
          </div>
        </CardBody>
      ) : (
        <CardBody>
          <Textarea
            data-testid={`settings-${settingKey}`}
            aria-label={`${title} JSON`}
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false); }}
            rows={8}
            spellCheck={false}
            className="mb-3 font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <GradientButton data-testid={`settings-save-${settingKey}`} onClick={save} size="sm" disabled={saving}>
              {saving ? <SpinnerIcon size={13} /> : null}
              {saving ? "Saving…" : "Save"}
            </GradientButton>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-[var(--sg-allow-text)]">
                <CheckCircleIcon size={14} />
                Saved.
              </span>
            )}
          </div>
          {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        </CardBody>
      )}
    </Card>
  );
}
