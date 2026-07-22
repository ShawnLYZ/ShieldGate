import { IncidentFeed } from "@/components/incident-feed";
import { IncidentsTrend } from "@/components/incidents-trend";
export default function IncidentsPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-semibold">Live incidents</h1>
      <div className="mb-6 rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-600">Incidents per day</h2>
        <IncidentsTrend />
      </div>
      <div className="rounded-lg border bg-white p-4"><IncidentFeed /></div>
    </main>
  );
}
