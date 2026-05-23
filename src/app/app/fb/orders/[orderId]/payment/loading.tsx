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
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3">
          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3">
              <Skeleton className="h-3 w-36 bg-console-border" />
            </div>
            <div className="grid gap-3 p-3.5">
              <div className="border border-console-border bg-console-bg p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-48" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-20 border border-console-border"
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-8 border border-console-border" />
                <Skeleton className="h-8 border border-console-border" />
              </div>
            </div>
          </section>
          <CardSkeleton rows={3} titleWidth="w-32" />
        </div>

        <aside className="border border-console-border bg-console-surface xl:sticky xl:top-4 xl:self-start">
          <div className="bg-console-ink px-3.5 py-2">
            <Skeleton className="h-3 w-36 bg-console-border" />
          </div>
          <div className="space-y-3 p-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border-b border-console-border-soft pb-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className={index === 3 ? "h-7 w-32" : "h-4 w-24"} />
              </div>
            ))}
            <Skeleton className="h-16 border border-console-border" />
          </div>
        </aside>
      </div>
    </main>
  );
}
