import { ShadowQueue } from "@/components/shadow-queue";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Shadow() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Shadow AI discovery"
        description="AI domains seen in identity-provider logs that are not in the tool registry. Promote one to open an approval request; dismiss the rest."
      />
      <Card>
        <ShadowQueue />
      </Card>
    </PageShell>
  );
}
