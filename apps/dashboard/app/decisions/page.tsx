import { DecisionsPanel } from "@/components/decisions-panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Decisions() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Govern"
        title="Decisions & appeals"
        description="AI-assisted decisions registered against a public reference, and the appeals filed against them by the people they affected."
      />
      <DecisionsPanel />
    </PageShell>
  );
}
