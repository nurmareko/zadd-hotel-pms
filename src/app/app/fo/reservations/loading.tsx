import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-36 border border-console-ink" />
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-console-border bg-console-surface p-3.5">
          <Skeleton className="h-8 w-full sm:w-[280px]" />
          <Skeleton className="h-8 w-full sm:w-[140px]" />
          <Skeleton className="h-8 w-full sm:w-[140px]" />
          <Skeleton className="h-8 w-full sm:w-[140px]" />
          <Skeleton className="h-8 w-full sm:w-[140px]" />
          <Skeleton className="h-8 w-16" />
          <span className="min-w-0 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1020px] border-collapse text-[12px]">
            <thead>
              <tr>
                {Array.from({ length: 9 }).map((_, index) => (
                  <th key={index} className="bg-console-ink px-3 py-2">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="odd:bg-console-surface even:bg-console-bg"
                >
                  {Array.from({ length: 9 }).map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="border-b border-console-border-soft px-3 py-[9px]"
                    >
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
