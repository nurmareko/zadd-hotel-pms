import {
  CardSkeleton,
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton titleWidth="w-72" subtitleWidth="w-80" />

      <KpiStripSkeleton count={4} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="border border-console-border bg-console-surface">
          <div className="flex items-center justify-between border-b border-console-border px-3.5 py-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <TableSkeleton rows={6} cols={5} minWidth="620px" />
        </section>

        <div className="flex min-w-0 flex-col gap-3">
          <section className="border border-console-border bg-console-surface">
            <div className="border-b border-console-border bg-console-ink px-3.5 py-3">
              <Skeleton className="h-3 w-36 bg-console-border" />
            </div>
            <TableSkeleton rows={5} cols={4} minWidth="440px" />
          </section>
          <CardSkeleton rows={6} titleWidth="w-32" />
        </div>
      </div>

      <div className="mt-4">
        <section className="border border-console-border bg-console-surface">
          <div className="border-b border-console-border bg-console-ink px-3.5 py-3">
            <Skeleton className="h-3 w-36 bg-console-border" />
          </div>
          <TableSkeleton rows={5} cols={4} minWidth="520px" />
        </section>
      </div>
    </main>
  );
}
