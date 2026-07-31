import { OutputRiskChart } from "@/components/output-risk-chart";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function OutputRisk() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Output risk"
        description={
          <>
            Flagged{" "}
            <code className="rounded bg-[var(--sg-surface-2)] px-1 py-0.5 font-mono text-[12px] text-[var(--sg-fg-secondary)]">
              output_flag
            </code>{" "}
            events — AI responses that tripped a policy rule on the way back — grouped by tool and
            by department.
          </>
        }
      />
      <OutputRiskChart />
    </PageShell>
  );
}
