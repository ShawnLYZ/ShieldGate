import { AuditViewer } from "@/components/audit-viewer";

export default function Audit() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Audit trail</h1>
      <div className="rounded-lg border bg-white p-4">
        <AuditViewer />
      </div>
    </main>
  );
}
