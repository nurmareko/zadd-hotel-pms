import { Skeleton } from "@/components/ui/skeleton";

function FloorPlanGroupSkeleton() {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2">
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-28 border border-console-border"
          />
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
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-3 w-44" />
        </div>
        <Skeleton className="h-8 w-36 border border-console-ink" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-24 border border-console-border"
          />
        ))}
      </div>

      <div className="mt-4 border-b border-console-border">
        <nav className="flex gap-5" aria-label="F&B tabs loading">
          <Skeleton className="h-8 w-20 border-b-2 border-console-border" />
          <Skeleton className="h-8 w-24 border-b-2 border-console-border" />
        </nav>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <FloorPlanGroupSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}
