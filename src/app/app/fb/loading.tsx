import {
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TabStripSkeleton,
} from "@/components/ui/skeleton";

function FloorPlanGroupSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[126px] rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
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
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
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
