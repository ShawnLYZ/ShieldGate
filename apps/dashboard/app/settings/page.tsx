import { SettingsEditor } from "@/components/settings-editor";

export default function Settings() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <div className="grid max-w-2xl gap-6">
        <SettingsEditor settingKey="cost_model" title="Cost model" />
        <SettingsEditor settingKey="risk_weights" title="Risk weights" />
      </div>
    </main>
  );
}
