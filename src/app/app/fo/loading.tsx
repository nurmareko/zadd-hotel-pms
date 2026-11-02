import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading Front Office" className="space-y-4 p-4 md:space-y-6 md:p-5 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-80" />
      </div>
      <div className="grid grid-cols-2 gap-5 rounded-lg border border-slate-200 bg-white p-5 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-full max-w-36" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <section key={index} className="rounded-lg border border-slate-200 bg-white">
            <div className="space-y-3 border-b border-slate-100 p-5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
            {Array.from({ length: 3 }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-40" />
                  <Skeleton className="h-3 w-full max-w-56" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0" />
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <Skeleton className="h-6 w-32" />
        <div className="mt-5 grid grid-cols-2 gap-5 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-5 w-full max-w-32" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
