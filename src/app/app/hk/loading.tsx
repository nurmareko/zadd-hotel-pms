import {
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton titleWidth="w-72" subtitleWidth="w-44" />

      <KpiStripSkeleton
        count={4}
        className="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4"
      />

      <section className="mt-4">
        <div className="sticky top-[57px] z-10 border-b border-console-border bg-console-bg md:top-0">
          <div className="flex">
            <Skeleton className="h-11 flex-1 border-b-2 border-console-border" />
            <Skeleton className="h-11 flex-1 border-b-2 border-console-border" />
          </div>
        </div>

        <div className="pt-3">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-24 shrink-0 border border-console-border"
              />
            ))}
          </div>

          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] gap-3 border border-console-border bg-console-surface p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-end gap-2">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-9 w-20 self-center border border-console-border" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
