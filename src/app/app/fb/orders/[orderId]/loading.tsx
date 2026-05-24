import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

function MenuGridSkeleton() {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex flex-col gap-3 border-b border-console-border bg-console-ink px-3.5 py-2 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-3 w-32 bg-console-border" />
        <Skeleton className="h-8 w-full border border-slate-600 bg-console-border md:max-w-[240px]" />
      </div>
      <div className="flex flex-wrap gap-3 border-b border-console-border px-3.5 py-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-5 w-20 border-b-2 border-console-border"
          />
        ))}
      </div>
      <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <article
            key={index}
            className="grid min-h-[126px] gap-3 border border-console-border bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-full border border-console-border" />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
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
