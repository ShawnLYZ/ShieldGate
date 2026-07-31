import { SettingsEditor } from "@/components/settings-editor";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Settings() {
  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow="Configure"
        title="Settings"
        description="Stored as JSON so the assumptions behind every derived number stay inspectable rather than hidden in code."
      />
      <div className="grid gap-4">
        <SettingsEditor settingKey="cost_model" title="Cost model" />
        <SettingsEditor settingKey="risk_weights" title="Risk weights" />
      </div>
    </PageShell>
  );
}
