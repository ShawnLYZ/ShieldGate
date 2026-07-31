import { AppealStatus } from "@/components/appeal-status";
import { BorderBeamPanel } from "@/components/ui/border-beam-panel";

// Next.js 15: dynamic route params are async (a Promise), so this stays a
// server component that awaits the param and hands a plain string to the
// client component doing the (unauthenticated) fetch -- same server-page /
// client-component split used by app/approvals/page.tsx.
export default async function AppealStatusPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[var(--sg-fg)]">
        Appeal status
      </h1>
      <p className="mb-6 text-sm text-[var(--sg-muted)]">
        The current state of the appeal you filed. Nothing here needs an account.
      </p>
      <BorderBeamPanel radius={16} idleSpeed={30} className="sg-rise bg-[var(--sg-surface)] p-5">
        <AppealStatus appealRef={ref} />
      </BorderBeamPanel>
    </main>
  );
}
