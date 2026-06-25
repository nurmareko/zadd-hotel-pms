import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

function MenuGridSkeleton() {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full rounded-md border border-gray-200 bg-slate-100 md:max-w-[240px]" />
      </div>
      <div className="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-8 w-20 rounded-full border border-gray-200 bg-slate-100"
          />
        ))}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 md:p-5 2xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <article
            key={index}
            className="grid min-h-[126px] gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-md border border-gray-200 bg-slate-100" />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton titleWidth="w-80" subtitleWidth="w-[420px]" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <MenuGridSkeleton />
        <aside className="flex min-w-0 flex-col gap-3">
          <CardSkeleton rows={4} titleWidth="w-36" />
          <CardSkeleton rows={6} titleWidth="w-28" />
          <CardSkeleton rows={4} titleWidth="w-32" />
        </aside>
      </div>
    </main>
  );
}
