import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-56"
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
          <div className="border-b border-gray-100 pb-4">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          </div>
          <div className="grid gap-x-5 gap-y-3 border-b border-gray-100 py-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
          <TableSkeleton rows={6} cols={4} minWidth="760px" />
          <div className="ml-auto mt-4 w-full max-w-xs space-y-2 rounded-lg border border-gray-200 bg-slate-50 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </section>
        <CardSkeleton rows={5} titleWidth="w-28" />
      </div>
    </main>
  );
}
