import { OutputRiskChart } from "@/components/output-risk-chart";

export default function OutputRisk() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Output risk</h1>
      <p className="mb-6 text-sm text-gray-600">
        Flagged <code>output_flag</code> events (AI responses that tripped a policy rule), grouped by tool and department.
      </p>
      <OutputRiskChart />
    </main>
  );
}
