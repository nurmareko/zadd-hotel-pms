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
        titleWidth="w-48"
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <div className="grid gap-4">
        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3">
            <Skeleton className="h-3 w-40 bg-console-border" />
          </div>
          <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-20 border border-console-border"
                  />
                ))}
              </div>
              <TableSkeleton rows={5} cols={5} minWidth="760px" />
            </div>
            <CardSkeleton rows={5} titleWidth="w-32" />
          </div>
        </section>

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3">
            <Skeleton className="h-3 w-32 bg-console-border" />
          </div>
          <TableSkeleton rows={4} cols={4} minWidth="720px" />
        </section>

        <Skeleton className="h-20 border border-console-border" />
      </div>
    </main>
  );
}
