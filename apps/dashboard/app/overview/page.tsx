"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { IncidentFeed } from "@/components/incident-feed";
import { CostCounter } from "@/components/cost-counter";
import { UsageByDepartment } from "@/components/usage-by-department";
import { UsageByTier } from "@/components/usage-by-tier";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangleIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { PageHeader, PageShell } from "@/components/ui/page";
import { StatTile } from "@/components/ui/stat";

export default function Overview() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.from("audit_events").select("*", { count: "exact", head: true })
      .then(({ count }) => setCount(count ?? 0));
  }, []);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Overview"
        description="Everything the gateway has classified, enforced and recorded — scoped to what your role is allowed to see."
      />

      <div className="sg-stagger mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Incidents logged"
          value={<span data-testid="incident-count">{count ?? "…"}</span>}
          hint="Append-only, hash-chained audit events"
          icon={<AlertTriangleIcon size={16} />}
          tone="warn"
        />
        <CostCounter />
        <StatTile
          label="Enforcement"
          value="Active"
          hint="FastAPI is the only writer; clients read via RLS"
          icon={<ShieldCheckIcon size={16} />}
          tone="allow"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <UsageByDepartment />
        <UsageByTier />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-[var(--sg-muted)]">
            <span
              aria-hidden="true"
              className="sg-live-dot size-1.5 rounded-full bg-[var(--sg-allow)]"
            />
            Streaming via Supabase Realtime
          </span>
        </CardHeader>
        <IncidentFeed />
      </Card>
    </PageShell>
  );
}
