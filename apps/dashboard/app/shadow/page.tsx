import { ShadowQueue } from "@/components/shadow-queue";

export default function Shadow() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Shadow AI discovery</h1>
      <div className="rounded-lg border bg-white p-4">
        <ShadowQueue />
      </div>
    </main>
  );
}
