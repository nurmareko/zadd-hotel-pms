import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-64"
        subtitleWidth="w-[460px]"
        actionCount={2}
      />

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border p-3.5">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-2 h-3 w-[420px] max-w-full" />
        </div>
        <div className="grid gap-4 p-3.5">
          <div className="grid gap-3 border border-console-border bg-console-bg p-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-16 border border-console-border"
                />
              ))}
            </div>
            <CardSkeleton rows={4} titleWidth="w-28" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <CardSkeleton key={index} rows={4} titleWidth="w-32" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
