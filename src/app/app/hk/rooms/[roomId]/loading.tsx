import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <header className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-start justify-between gap-3 border border-console-border bg-console-surface p-3.5">
            <div className="min-w-0">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-16 border border-console-border" />
          </div>
        </header>

        <CardSkeleton rows={4} titleWidth="w-32" />
        <CardSkeleton rows={3} titleWidth="w-28" />

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3">
            <Skeleton className="h-3 w-24 bg-console-border" />
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="grid gap-1 border-t border-console-border-soft px-3.5 py-3 first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
