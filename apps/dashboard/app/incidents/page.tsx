import { IncidentFeed } from "@/components/incident-feed";
import { IncidentsTrend } from "@/components/incidents-trend";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function IncidentsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Live incidents"
        description="Every prompt or response the policy matrix warned or blocked. Rows arrive over Realtime and inherit the same RLS as a query, so a manager's feed is department-scoped for free."
      />

      <Card className="mb-4">
        <CardHeader>
          <div>
            <CardTitle>Incidents per day</CardTitle>
            <CardDescription>Count of governance events, by calendar day</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <IncidentsTrend />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event feed</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-[var(--sg-muted)]">
            <span
              aria-hidden="true"
              className="sg-live-dot size-1.5 rounded-full bg-[var(--sg-allow)]"
            />
            Live · click a row for the drilldown
          </span>
        </CardHeader>
        <IncidentFeed />
      </Card>
    </PageShell>
  );
}
