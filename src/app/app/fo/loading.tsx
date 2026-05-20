import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton() {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Skeleton className="h-6 w-72" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
      </div>
    </div>
  );
}

function TableCardSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex items-center justify-between border-b border-console-border px-3.5 py-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="overflow-hidden">
        <div className="grid grid-cols-5 bg-console-ink px-2 py-2">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="mx-1 h-3" />
          ))}
        </div>
        <div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-5 border-b border-console-border-soft px-2 py-[9px] odd:bg-console-surface even:bg-console-bg"
            >
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className="mx-1 h-4"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <HeaderSkeleton />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-24 border border-console-border"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <TableCardSkeleton rows={6} columns={5} />
        <div className="flex min-w-0 flex-col gap-3">
          <TableCardSkeleton rows={5} columns={4} />
          <section className="border border-console-border bg-console-surface">
            <div className="border-b border-console-border px-3.5 py-3">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-2 p-3.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-10" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4">
        <TableCardSkeleton rows={5} columns={4} />
      </div>
    </main>
  );
}
