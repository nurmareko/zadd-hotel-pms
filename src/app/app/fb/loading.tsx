import {
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TabStripSkeleton,
} from "@/components/ui/skeleton";

function FloorPlanGroupSkeleton() {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2">
        <Skeleton className="h-3 w-28 bg-console-border" />
      </div>
      <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[126px] border border-l-4 border-console-border bg-console-surface p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="mt-3 h-3 w-24" />
            <Skeleton className="mt-4 h-4 w-32 max-w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-40"
        subtitleWidth="w-44"
        actionCount={1}
      />

      <KpiStripSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />

      <TabStripSkeleton className="mt-4" />

      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <FloorPlanGroupSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}
