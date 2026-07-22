import { ApprovalQueue } from "@/components/approval-queue";

export default function Approvals() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Approvals</h1>
      <div className="rounded-lg border bg-white p-4">
        <ApprovalQueue />
      </div>
    </main>
  );
}
