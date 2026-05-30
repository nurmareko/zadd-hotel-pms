import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-console-border-soft", className)}
      {...props}
    />
  );
}

type PageHeaderSkeletonProps = {
  titleWidth?: string;
  subtitleWidth?: string;
  actionCount?: number;
  className?: string;
};

export function PageHeaderSkeleton({
  titleWidth = "w-64",
  subtitleWidth = "w-80",
  actionCount = 0,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <Skeleton className={cn("h-6 max-w-full", titleWidth)} />
        <Skeleton className={cn("mt-2 h-3 max-w-full", subtitleWidth)} />
      </div>
      {actionCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actionCount }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                "h-8 border border-console-border",
                index === 0 ? "w-28" : "w-32",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KpiStripSkeleton({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <section
          key={index}
          className="border border-console-border bg-console-surface p-3.5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-32 max-w-full" />
        </section>
      ))}
    </div>
  );
}

type TableSkeletonProps = {
  rows: number;
  cols: number;
  minWidth?: string;
  className?: string;
};

export function TableSkeleton({
  rows,
  cols,
  minWidth = "760px",
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("overflow-auto", className)}>
      <table
        className="w-full border-collapse text-[12px]"
        style={{ minWidth }}
      >
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, index) => (
              <th key={index} className="bg-console-ink px-3 py-2">
                <Skeleton className="h-3 w-20 bg-console-border" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="odd:bg-console-surface even:bg-console-bg"
            >
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="border-b border-console-border-soft px-3 py-[9px]"
                >
                  <Skeleton
                    className={cn(
                      "h-4",
                      colIndex === cols - 1 ? "ml-auto w-12" : "w-full",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton({
  rows = 4,
  titleWidth = "w-36",
  className,
}: {
  rows?: number;
  titleWidth?: string;
  className?: string;
}) {
  return (
    <section
      className={cn("border border-console-border bg-console-surface", className)}
    >
      <div className="bg-console-ink px-3.5 py-3">
        <Skeleton className={cn("h-3 bg-console-border", titleWidth)} />
      </div>
      <div className="space-y-3 p-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32 max-w-[55%]" />
            <Skeleton className="h-4 w-24 max-w-[35%]" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FilterBarSkeleton({
  fields = 3,
  showCount = true,
}: {
  fields?: number;
  showCount?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-console-border bg-console-surface p-3.5 lg:flex-row lg:items-center">
      <Skeleton className="h-8 w-full border border-console-border sm:w-[280px]" />
      {Array.from({ length: fields }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-8 w-full border border-console-border sm:w-[140px]"
        />
      ))}
      {showCount ? (
        <>
          <span className="min-w-0 flex-1" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : null}
    </div>
  );
}

export function TabStripSkeleton({
  count = 2,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-console-border", className)}>
      <nav className="flex gap-5" aria-label="Memuat tab">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-9 border-b-2 border-console-border",
              index === 0 ? "w-24" : "w-32",
            )}
          />
        ))}
      </nav>
    </div>
  );
}

export function AdminTableLoadingSkeleton({
  titleWidth = "w-64",
  subtitleWidth = "w-80",
  kpiCount = 0,
  tabCount = 0,
  filterFields = 2,
  actionCount = 1,
  rows = 8,
  cols = 6,
  minWidth = "760px",
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  kpiCount?: number;
  tabCount?: number;
  filterFields?: number;
  actionCount?: number;
  rows?: number;
  cols?: number;
  minWidth?: string;
}) {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <PageHeaderSkeleton
        titleWidth={titleWidth}
        subtitleWidth={subtitleWidth}
        actionCount={actionCount}
      />
      {kpiCount > 0 ? (
        <KpiStripSkeleton
          count={kpiCount}
          className="mb-4 md:grid-cols-3 xl:grid-cols-3"
        />
      ) : null}
      {tabCount > 0 ? (
        <TabStripSkeleton count={tabCount} className="mb-4" />
      ) : null}
      <section className="border border-console-border bg-console-surface">
        <FilterBarSkeleton fields={filterFields} />
        <TableSkeleton rows={rows} cols={cols} minWidth={minWidth} />
      </section>
    </main>
  );
}
