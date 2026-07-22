"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authedGet } from "@/lib/api";

// Incident count per day: a single sequential series (change over time, one measure).
// Reuses the validated slot-1 blue (#2a78d6, light-mode PASS) so every chart in the app
// reads as one system — same form the executive report already validated.
const TREND_BLUE = "#2a78d6";

export function IncidentsTrend() {
  const [trend, setTrend] = useState<{ date: string; incidents: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authedGet("/api/v1/reports/executive")
      .then((d) => { if (active) setTrend((d as { risk_trend: { date: string; incidents: number }[] }).risk_trend); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load trend"); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!trend) return <div className="text-sm text-gray-500">Loading…</div>;
  if (trend.length === 0) return <div className="text-sm text-gray-500">No incidents yet.</div>;

  return (
    <div data-testid="incidents-trend" style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="incidents" stroke={TREND_BLUE} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
