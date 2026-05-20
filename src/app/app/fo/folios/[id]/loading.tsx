import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="space-y-3 p-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Skeleton className="h-6 w-80 max-w-full" />
          <Skeleton className="mt-2 h-3 w-[520px] max-w-full" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-28 border border-console-border" />
          ))}
        </div>
      </div>

      <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <CardSkeleton rows={7} />
          <CardSkeleton rows={4} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={6} />
        </aside>
      </div>
    </main>
  );
}
