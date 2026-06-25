import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

const ROWS = 10;
const DAYS = 14;

export default function Loading() {
  const tableMinWidth = 128 + DAYS * 64;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth="w-48"
        subtitleWidth="w-[420px]"
        actionCount={5}
      />

      <div className="mb-3 flex flex-col gap-2 text-[12px] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-5 w-24 border border-slate-200"
            />
          ))}
        </div>
        <Skeleton className="h-3 w-28 sm:ml-auto" />
      </div>

      <div
        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
        style={{ maxHeight: 520, padding: 0 }}
      >
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          <table
            className="w-full border-separate border-spacing-0 text-[12px]"
            style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}
          >
            <thead>
              <tr>
                <th
                  className="border-b border-r border-slate-200 bg-slate-50 px-2.5 py-2 text-left"
                  style={{ minWidth: 128, width: 128 }}
                >
                  <Skeleton className="h-3 w-14" />
                </th>
                {Array.from({ length: DAYS }).map((_, index) => (
                  <th
                    key={index}
                    className="border-b border-slate-200 bg-slate-50 px-1 py-1.5"
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
                    className="border-b border-r border-slate-100 bg-white px-2.5 py-0 text-left"
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
                      className="border-b border-r border-slate-100 p-0"
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
