import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
      </div>

      <div className="mb-4 flex gap-5 border-b border-console-border">
        <Skeleton className="h-9 w-24 border-b-2 border-console-border" />
        <Skeleton className="h-9 w-32 border-b-2 border-console-border" />
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="flex flex-col gap-3 border-b border-console-border bg-console-ink px-3.5 py-3 text-console-accent sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-[220px]" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12px]">
            <thead>
              <tr>
                {Array.from({ length: 6 }).map((_, index) => (
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
                  {Array.from({ length: 6 }).map((_, columnIndex) => (
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
