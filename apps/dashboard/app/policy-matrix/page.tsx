import { MatrixEditor } from "@/components/matrix-editor";

export default function PolicyMatrix() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Policy matrix</h1>
      <div className="rounded-lg border bg-white p-4">
        <MatrixEditor />
      </div>
    </main>
  );
}
