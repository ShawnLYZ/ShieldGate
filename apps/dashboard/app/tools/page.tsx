import { ToolsRegistry } from "@/components/tools-registry";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Tools() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Configure"
        title="Tool registry"
        description="Tier is risk; continuity is availability. They are separate facts on purpose — suspending a tool enforces it as Tier 0 at the point of use without rewriting its assessed tier."
      />
      <Card>
        <ToolsRegistry />
      </Card>
    </PageShell>
  );
}
