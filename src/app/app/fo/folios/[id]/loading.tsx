import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-80"
        subtitleWidth="w-[520px]"
        actionCount={4}
      />

      <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
              <Skeleton className="h-3 w-36 bg-slate-200" />
            </div>
            <TableSkeleton rows={7} cols={6} minWidth="720px" />
          </section>
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
              <Skeleton className="h-3 w-32 bg-slate-200" />
            </div>
            <TableSkeleton rows={4} cols={5} minWidth="640px" />
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <CardSkeleton rows={4} titleWidth="w-28" />
          <CardSkeleton rows={6} titleWidth="w-32" />
        </aside>
      </div>
    </main>
  );
}
