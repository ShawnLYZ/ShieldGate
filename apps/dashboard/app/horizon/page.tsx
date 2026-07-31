import { WatchList } from "@/components/watch-list";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Horizon() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Govern"
        title="Regulatory horizon"
        description="Watched sources for rules that would change the policy matrix. Anything published after the last matrix bump is flagged as possibly stale."
      />
      <Card>
        <WatchList />
      </Card>
    </PageShell>
  );
}
