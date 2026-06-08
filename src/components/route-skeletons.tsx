import type { ReactNode } from "react";

import {
  CardSkeleton,
  FilterBarSkeleton,
  KpiStripSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
  TabStripSkeleton,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

function PageShell({ children, className, contentClassName }: PageShellProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5",
        className,
      )}
    >
      <div className={contentClassName}>{children}</div>
    </main>
  );
}

function PanelHeaderSkeleton({
  titleWidth = "w-36",
  metaWidth,
}: {
  titleWidth?: string;
  metaWidth?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-console-border bg-console-ink px-3.5 py-3">
      <Skeleton className={cn("h-3 bg-console-border", titleWidth)} />
      {metaWidth ? (
        <Skeleton className={cn("h-3 bg-console-border", metaWidth)} />
      ) : null}
    </div>
  );
}

function FieldRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-10 w-full border border-console-border bg-white" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({
  kpiCount = 4,
  sectionCount = 3,
  actionCount = 0,
}: {
  kpiCount?: number;
  sectionCount?: number;
  actionCount?: number;
}) {
  return (
    <PageShell>
      <PageHeaderSkeleton
        titleWidth="w-72"
        subtitleWidth="w-80"
        actionCount={actionCount}
      />
      <KpiStripSkeleton count={kpiCount} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="border border-console-border bg-console-surface">
          <PanelHeaderSkeleton titleWidth="w-40" metaWidth="w-20" />
          <TableSkeleton rows={6} cols={5} minWidth="620px" />
        </section>
        <div className="flex min-w-0 flex-col gap-3">
          {Array.from({ length: Math.max(1, sectionCount - 1) }).map(
            (_, index) => (
              <CardSkeleton key={index} rows={index === 0 ? 5 : 4} />
            ),
          )}
        </div>
      </div>
    </PageShell>
  );
}

export function CrudTablePageSkeleton({
  cols,
  rows,
  hasFilter = true,
  hasTabs = false,
  hasDateNav = false,
  tabCount = 2,
  filterFields = 2,
  actionCount = 1,
  kpiCount = 0,
  minWidth = "760px",
  titleWidth = "w-64",
  subtitleWidth = "w-80",
}: {
  cols: number;
  rows: number;
  hasFilter?: boolean;
  hasTabs?: boolean;
  hasDateNav?: boolean;
  tabCount?: number;
  filterFields?: number;
  actionCount?: number;
  kpiCount?: number;
  minWidth?: string;
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <PageShell>
      <PageHeaderSkeleton
        titleWidth={titleWidth}
        subtitleWidth={subtitleWidth}
        actionCount={actionCount}
      />
      {hasTabs ? <TabStripSkeleton count={tabCount} className="mb-4" /> : null}
      {kpiCount > 0 ? (
        <KpiStripSkeleton
          count={kpiCount}
          className="mb-4 md:grid-cols-3 xl:grid-cols-3"
        />
      ) : null}
      {hasDateNav ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-36 border border-console-border" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-36 border border-console-border" />
        </div>
      ) : null}
      <section className="border border-console-border bg-console-surface">
        {hasFilter ? <FilterBarSkeleton fields={filterFields} /> : null}
        <TableSkeleton rows={rows} cols={cols} minWidth={minWidth} />
      </section>
    </PageShell>
  );
}

export function CardListPageSkeleton({
  cards = 8,
  grouped = false,
  groups = 2,
  actionCount = 1,
}: {
  cards?: number;
  grouped?: boolean;
  groups?: number;
  actionCount?: number;
}) {
  const cardGrid = (count: number) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} rows={4} titleWidth="w-28" />
      ))}
    </div>
  );

  return (
    <PageShell>
      <PageHeaderSkeleton actionCount={actionCount} />
      {grouped ? (
        <div className="space-y-4">
          {Array.from({ length: groups }).map((_, index) => (
            <section
              key={index}
              className="border border-console-border bg-console-surface"
            >
              <PanelHeaderSkeleton titleWidth="w-32" />
              <div className="p-3.5">{cardGrid(Math.max(1, cards))}</div>
            </section>
          ))}
        </div>
      ) : (
        cardGrid(cards)
      )}
    </PageShell>
  );
}

export function FormPageSkeleton({
  fieldRows = 4,
  splitAuth = false,
  actionCount = 0,
  contentClassName = "mx-auto max-w-[600px]",
  showHeader = true,
  withShell = true,
}: {
  fieldRows?: number;
  splitAuth?: boolean;
  actionCount?: number;
  contentClassName?: string;
  showHeader?: boolean;
  withShell?: boolean;
}) {
  if (splitAuth) {
    return (
      <main className="min-h-screen bg-console-surface font-mono text-console-ink md:grid md:grid-cols-[45%_55%]">
        <section className="relative hidden overflow-hidden bg-console-ink px-10 py-9 text-white md:flex md:flex-col md:justify-between lg:px-14">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,212,170,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.22) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-px bg-console-accent"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <Skeleton className="size-9 border border-console-accent bg-transparent" />
            <div>
              <Skeleton className="h-3 w-24 bg-white/20" />
              <Skeleton className="mt-2 h-2.5 w-48 bg-white/10" />
            </div>
          </div>
          <div className="relative max-w-md">
            <Skeleton className="h-3 w-40 bg-console-accent/40" />
            <Skeleton className="mt-4 h-8 w-80 max-w-full bg-white/20" />
            <Skeleton className="mt-2 h-8 w-64 max-w-full bg-white/20" />
            <Skeleton className="mt-5 h-3 w-full bg-white/10" />
            <Skeleton className="mt-2 h-3 w-4/5 bg-white/10" />
          </div>
          <div className="relative flex items-center justify-between border-t border-white/10 pt-5">
            <Skeleton className="h-3 w-28 bg-white/10" />
            <Skeleton className="h-3 w-36 bg-white/10" />
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-console-bg px-5 py-8 sm:px-8 md:bg-console-surface">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 md:hidden">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 border border-console-border" />
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-2.5 w-48 max-w-full" />
                </div>
              </div>
            </div>
            <section className="border border-console-border bg-console-surface">
              <PanelHeaderSkeleton titleWidth="w-20" />
              <div className="px-5 py-6 sm:px-7 sm:py-7">
                <div className="mb-6">
                  <Skeleton className="h-6 w-64 max-w-full" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
                <FieldRowsSkeleton rows={fieldRows} />
                <Skeleton className="mt-5 h-10 w-full border border-console-border bg-console-ink" />
                <div className="mt-4 border-t border-console-border-soft pt-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton
                        key={index}
                        className="h-8 border border-console-border"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const content = (
    <>
      {showHeader ? <PageHeaderSkeleton actionCount={actionCount} /> : null}
      <section className="overflow-hidden border border-console-border bg-console-surface">
        <PanelHeaderSkeleton titleWidth="w-36" />
        <div className="px-3.5 py-4">
          <FieldRowsSkeleton rows={fieldRows} />
          <div className="mt-4 flex justify-end border-t border-console-border pt-4">
            <Skeleton className="h-8 w-32 border border-console-border bg-console-ink" />
          </div>
        </div>
      </section>
    </>
  );

  if (!withShell) {
    return content;
  }

  return <PageShell contentClassName={contentClassName}>{content}</PageShell>;
}

export function DetailPageSkeleton({
  cardCount = 2,
  rowsPerCard = 5,
  hasTabs = false,
  emptyState = false,
  contentClassName,
  withShell = true,
}: {
  cardCount?: number;
  rowsPerCard?: number;
  hasTabs?: boolean;
  emptyState?: boolean;
  contentClassName?: string;
  withShell?: boolean;
}) {
  if (emptyState) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-console-bg p-6">
        <section className="min-h-[280px] w-full max-w-xl border border-console-border bg-console-surface px-6 py-10">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <Skeleton className="size-12 border border-console-border" />
            <Skeleton className="mt-5 h-6 w-44" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-5/6" />
            <Skeleton className="mt-6 h-8 w-32 border border-console-border bg-console-ink" />
          </div>
        </section>
      </main>
    );
  }

  const content = (
    <>
      <PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-56" />
      {hasTabs ? <TabStripSkeleton className="mb-4" /> : null}
      <div className="space-y-3">
        {Array.from({ length: cardCount }).map((_, index) => (
          <CardSkeleton
            key={index}
            rows={rowsPerCard}
            titleWidth={index === 0 ? "w-20" : "w-40"}
          />
        ))}
      </div>
    </>
  );

  if (!withShell) {
    return content;
  }

  return <PageShell contentClassName={contentClassName}>{content}</PageShell>;
}

export function WorkflowPageSkeleton({
  summaryCount = 3,
  actionRows = 4,
}: {
  summaryCount?: number;
  actionRows?: number;
}) {
  return (
    <PageShell>
      <PageHeaderSkeleton actionCount={1} />
      <KpiStripSkeleton count={summaryCount} className="md:grid-cols-3" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-console-border bg-console-surface">
          <PanelHeaderSkeleton titleWidth="w-40" />
          <div className="p-3.5">
            <FieldRowsSkeleton rows={actionRows} />
          </div>
        </section>
        <CardSkeleton rows={6} titleWidth="w-32" />
      </div>
    </PageShell>
  );
}

export function CalendarTapeChartSkeleton({
  lanes = 10,
  days = 14,
  laneWidth = 128,
  dayWidth = 64,
}: {
  lanes?: number;
  days?: number;
  laneWidth?: number;
  dayWidth?: number;
}) {
  const tableMinWidth = laneWidth + days * dayWidth;

  return (
    <PageShell>
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
              className="h-5 w-24 border border-console-border-soft"
            />
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
                  className="border-b border-r border-console-border bg-console-bg px-2.5 py-2 text-left"
                  style={{ minWidth: laneWidth, width: laneWidth }}
                >
                  <Skeleton className="h-3 w-14" />
                </th>
                {Array.from({ length: days }).map((_, index) => (
                  <th
                    key={index}
                    className="border-b border-console-border bg-console-bg px-1 py-1.5"
                    style={{ minWidth: dayWidth, width: dayWidth }}
                  >
                    <Skeleton className="mx-auto h-3 w-8" />
                    <Skeleton className="mx-auto mt-1 h-3 w-4" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lanes }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <th
                    className="border-b border-r border-console-border-soft bg-console-surface px-2.5 py-0 text-left"
                    style={{ height: 32, minWidth: laneWidth, width: laneWidth }}
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </th>
                  {Array.from({ length: days }).map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="border-b border-r border-console-border-soft p-0"
                      style={{ height: 32, minWidth: dayWidth, width: dayWidth }}
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
    </PageShell>
  );
}

export function RedirectShellSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-console-bg p-6 text-console-ink">
      <section className="w-full max-w-sm border border-console-border bg-console-surface p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 border border-console-border" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
