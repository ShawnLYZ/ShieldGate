import { AuditViewer } from "@/components/audit-viewer";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Audit() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Evidence"
        title="Audit trail"
        description="An append-only hash chain. Verify recomputes every link server-side and names the first sequence number that fails — raw prompt text is never stored, only a masked excerpt."
      />
      <Card>
        <AuditViewer />
      </Card>
    </PageShell>
  );
}
