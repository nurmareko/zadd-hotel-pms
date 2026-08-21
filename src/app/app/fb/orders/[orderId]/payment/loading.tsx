import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-64"
        subtitleWidth="w-[360px]"
        actionCount={1}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3">
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <div className="grid gap-3 p-4 md:p-5">
              <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-48" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-24 rounded-lg border border-gray-200 bg-slate-100"
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-10 rounded-md border border-gray-200 bg-slate-100" />
                <Skeleton className="h-10 rounded-md border border-gray-200 bg-slate-100" />
              </div>
            </div>
          </section>
          <CardSkeleton rows={3} titleWidth="w-32" />
        </div>

        <aside className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm desktop:xl:sticky desktop:xl:top-4 desktop:xl:self-start">
          <div className="border-b border-gray-100 px-5 py-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-52" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className={index === 3 ? "h-7 w-32" : "h-4 w-24"} />
              </div>
            ))}
            <Skeleton className="h-16 rounded-lg border border-gray-200 bg-slate-100" />
          </div>
        </aside>
      </div>
    </main>
  );
}
