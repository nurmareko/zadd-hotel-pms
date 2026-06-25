import {
  CardListPageSkeleton,
  CrudTablePageSkeleton,
} from "@/components/route-skeletons";
import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

function FilterAndAddBarSkeleton() {
  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3.5">
        <Skeleton className="h-8 w-full border border-slate-200 sm:w-[300px]" />
        <Skeleton className="h-8 w-full border border-slate-200 sm:w-[110px]" />
        <Skeleton className="h-8 w-full border border-slate-200 sm:w-[150px]" />
        <Skeleton className="h-8 w-20 rounded-md border border-slate-200 bg-slate-900 shadow-sm" />
        <span className="min-w-0 flex-1" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid gap-2 p-3.5 md:grid-cols-[minmax(220px,1fr)_150px_auto]">
        <Skeleton className="h-8 border border-slate-200" />
        <Skeleton className="h-8 border border-slate-200" />
        <Skeleton className="h-8 w-full rounded-md border border-slate-200 bg-slate-900 shadow-sm md:w-32" />
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton titleWidth="w-44" subtitleWidth="w-40" />
      <FilterAndAddBarSkeleton />

      <div className="md:hidden">
        <CardListPageSkeleton
          cards={6}
          actionCount={0}
          showHeader={false}
          withShell={false}
        />
      </div>

      <div className="hidden md:block">
        <CrudTablePageSkeleton
          cols={6}
          rows={8}
          hasFilter={false}
          actionCount={0}
          minWidth="980px"
          showHeader={false}
          withShell={false}
        />
      </div>
    </main>
  );
}
