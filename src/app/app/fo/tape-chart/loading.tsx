import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 10;
const DAYS = 7;

export default function Loading() {
  const tableMinWidth = 128 + DAYS * 64;

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-3 w-[420px] max-w-full" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-8 border border-console-border" />
          <Skeleton className="h-8 w-44 border border-console-border" />
          <Skeleton className="h-8 w-8 border border-console-border" />
          <Skeleton className="h-8 w-28 border border-console-border" />
          <Skeleton className="h-8 w-36 border border-console-border" />
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 text-[12px] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-24 border border-console-border-soft" />
          ))}
        </div>
        <Skeleton className="h-3 w-28 sm:ml-auto" />
      </div>

      <div
        className="border border-console-border bg-console-surface"
        style={{ maxHeight: 520, overflow: "hidden", padding: 0 }}
      >
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          <table
            className="w-full border-separate border-spacing-0 text-[12px]"
            style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}
          >
            <thead>
              <tr>
                <th
                  className="border-b border-r border-console-border bg-slate-50 px-2.5 py-2 text-left"
                  style={{ minWidth: 128, width: 128 }}
                >
                  <Skeleton className="h-3 w-14" />
                </th>
                {Array.from({ length: DAYS }).map((_, index) => (
                  <th
                    key={index}
                    className="border-b border-console-border bg-slate-50 px-1 py-1.5"
                    style={{ minWidth: 64, width: 64 }}
                  >
                    <Skeleton className="mx-auto h-3 w-8" />
                    <Skeleton className="mx-auto mt-1 h-3 w-4" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <th
                    className="border-b border-r border-console-border-soft bg-console-surface px-2.5 py-0 text-left"
                    style={{ height: 32, minWidth: 128, width: 128 }}
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </th>
                  {Array.from({ length: DAYS }).map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="border-b border-r border-console-border-soft p-0"
                      style={{ height: 32, minWidth: 64, width: 64 }}
                    >
                      <Skeleton className="m-0.5 h-[28px]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
