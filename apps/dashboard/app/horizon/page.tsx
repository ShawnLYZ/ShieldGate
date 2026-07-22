import { WatchList } from "@/components/watch-list";

export default function Horizon() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Regulatory horizon</h1>
      <div className="rounded-lg border bg-white p-4">
        <WatchList />
      </div>
    </main>
  );
}
