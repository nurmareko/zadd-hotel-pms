import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Memuat log aktivitas" className="min-h-screen space-y-4 bg-slate-50 p-4 md:p-5 lg:space-y-6 lg:p-6">
      <PageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-96" />
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row lg:p-5">
        <Skeleton className="h-16 w-full sm:w-64" />
        <Skeleton className="h-16 w-full sm:w-72" />
        <Skeleton className="h-10 w-32 self-start sm:self-end" />
      </div>
      <div className="divide-y rounded-lg border bg-white shadow-sm">
        <div className="p-4"><Skeleton className="h-5 w-40" /></div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="grid gap-3 p-4 sm:grid-cols-2 desktop:grid-cols-5">
            {Array.from({ length: 5 }, (_, column) => <Skeleton key={column} className="h-5 w-full" />)}
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-3 p-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-48" /></div>
      </div>
    </main>
  );
}
