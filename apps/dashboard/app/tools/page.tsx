import { ToolsRegistry } from "@/components/tools-registry";

export default function Tools() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Tool registry</h1>
      <div className="rounded-lg border bg-white p-4">
        <ToolsRegistry />
      </div>
    </main>
  );
}
