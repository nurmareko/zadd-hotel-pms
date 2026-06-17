import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <header className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5">
            <div className="min-w-0">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-16 border border-slate-200" />
          </div>
        </header>

        <CardSkeleton rows={4} titleWidth="w-32" />
        <CardSkeleton rows={3} titleWidth="w-28" />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-900 px-3.5 py-3">
            <Skeleton className="h-3 w-24 bg-slate-200" />
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="grid gap-1 border-t border-slate-100 px-3.5 py-3 first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start"
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
