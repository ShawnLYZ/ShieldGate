import { MyRequests } from "@/components/my-requests";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function MyRequestsPage() {
  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        eyebrow="Govern"
        title="My requests"
        description="Ask for a tool, then watch it move through review. You only ever see your own rows — that boundary is enforced in Postgres, not here."
      />
      <MyRequests />
    </PageShell>
  );
}
