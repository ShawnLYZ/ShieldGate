"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { IncidentFeed } from "@/components/incident-feed";
import { CostCounter } from "@/components/cost-counter";
import { UsageByDepartment } from "@/components/usage-by-department";
import { UsageByTier } from "@/components/usage-by-tier";

export default function Overview() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.from("audit_events").select("*", { count: "exact", head: true })
      .then(({ count }) => setCount(count ?? 0));
  }, []);
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Overview</h1>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Incidents logged</div>
          <div data-testid="incident-count" className="text-3xl font-semibold">{count ?? "…"}</div>
        </div>
        <CostCounter />
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <UsageByDepartment />
        <UsageByTier />
      </div>
      <h2 className="mb-2 text-lg font-medium">Recent activity</h2>
      <div className="rounded-lg border bg-white p-4"><IncidentFeed /></div>
    </main>
  );
}
