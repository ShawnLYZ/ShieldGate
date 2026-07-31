import { ApprovalQueue } from "@/components/approval-queue";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Approvals() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Govern"
        title="Approvals"
        description="Tool-access requests move through two reviewers — a manager and an admin. The risk score recommends a tier band; the reviewer assigns the tier that actually lands in the registry."
      />
      <Card>
        <ApprovalQueue />
      </Card>
    </PageShell>
  );
}
