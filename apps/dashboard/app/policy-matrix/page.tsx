import { MatrixEditor } from "@/components/matrix-editor";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function PolicyMatrix() {
  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        eyebrow="Configure"
        title="Policy matrix"
        description="Data category × tool tier → action. This is the whole enforcement rule set; saving bumps the policy version, and every extension picks the new one up on its next snapshot sync."
      />
      <Card>
        <MatrixEditor />
      </Card>
    </PageShell>
  );
}
