import {
  CardSkeleton,
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-44"
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <KpiStripSkeleton count={5} className="md:grid-cols-2 xl:grid-cols-5" />

      <section className="mt-4 border border-status-vd-pip bg-status-vd-bg">
        <div className="bg-accent/50 px-5 py-4">
          <Skeleton className="h-3 w-36 bg-muted" />
        </div>
        <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-2 h-3 w-[420px] max-w-full" />
          </div>
          <Skeleton className="h-8 w-full border border-border" />
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-border bg-card rounded-2xl">
          <div className="bg-accent/50 px-3.5 py-3">
            <Skeleton className="h-3 w-36 bg-muted" />
          </div>
          <TableSkeleton rows={8} cols={7} minWidth="980px" />
        </section>
        <CardSkeleton rows={4} titleWidth="w-28" />
      </div>
    </main>
  );
}
