import { AppealStatus } from "@/components/appeal-status";

// Next.js 15: dynamic route params are async (a Promise), so this stays a
// server component that awaits the param and hands a plain string to the
// client component doing the (unauthenticated) fetch -- same server-page /
// client-component split used by app/approvals/page.tsx.
export default async function AppealStatusPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Appeal status</h1>
      <div className="rounded-lg border bg-white p-4">
        <AppealStatus appealRef={ref} />
      </div>
    </main>
  );
}
