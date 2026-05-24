import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-56"
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-console-border bg-console-surface p-3.5">
          <div className="border-b border-console-border pb-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          </div>
          <div className="grid gap-x-5 gap-y-2 border-b border-console-border py-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
          <TableSkeleton rows={6} cols={4} minWidth="760px" />
          <div className="ml-auto mt-3 w-full max-w-xs space-y-2 border-t border-console-border-soft pt-3">
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
