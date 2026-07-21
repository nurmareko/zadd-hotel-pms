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
        "min-h-screen bg-slate-50 px-5 py-4 font-jakarta text-slate-900 md:px-6 md:py-5",
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
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
      <Skeleton className={cn("h-3 bg-slate-200", titleWidth)} />
      {metaWidth ? (
        <Skeleton className={cn("h-3 bg-slate-200", metaWidth)} />
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
          <Skeleton className="mt-2 h-10 w-full rounded-md border border-gray-200 bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({
  kpiCount = 4,
  sectionCount = 3,
  actionCount = 0,
  variant = "default",
}: {
  kpiCount?: number;
  sectionCount?: number;
  actionCount?: number;
  variant?: "default" | "hkSupervisor";
}) {
  if (variant === "hkSupervisor") {
    return <HkSupervisorDashboardSkeleton actionCount={actionCount} />;
  }

  return (
    <PageShell>
      <PageHeaderSkeleton
        titleWidth="w-72"
        subtitleWidth="w-80"
        actionCount={actionCount}
      />
      <KpiStripSkeleton count={kpiCount} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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

function HkSupervisorDashboardSkeleton({
  actionCount,
}: {
  actionCount: number;
}) {
  return (
    <PageShell>
      <PageHeaderSkeleton
        titleWidth="w-64"
        subtitleWidth="w-72"
        actionCount={actionCount}
      />

      <section className="mb-4">
        <PanelHeaderSkeleton titleWidth="w-28" />
        <KpiStripSkeleton
          count={3}
          className="mt-2 grid-cols-3 xl:grid-cols-3"
        />
      </section>

      <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <PanelHeaderSkeleton titleWidth="w-32" metaWidth="w-16" />
        <TableSkeleton rows={4} cols={4} minWidth="680px" />
      </section>

      <section className="mb-4">
        <PanelHeaderSkeleton titleWidth="w-52" />
        <KpiStripSkeleton
          count={6}
          className="mt-2 grid-cols-2 xl:grid-cols-6"
        />
      </section>

      <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <PanelHeaderSkeleton titleWidth="w-36" />
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Skeleton className="size-8 rounded-md border border-gray-200 bg-slate-100" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <PanelHeaderSkeleton titleWidth="w-44" metaWidth="w-24" />
        <div className="grid gap-3 p-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <FieldRowsSkeleton rows={3} />
          <TableSkeleton rows={6} cols={5} minWidth="720px" />
        </div>
      </section>
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
  showHeader = true,
  withShell = true,
  contentClassName,
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
  showHeader?: boolean;
  withShell?: boolean;
  contentClassName?: string;
}) {
  const content = (
    <>
      {showHeader ? (
        <PageHeaderSkeleton
          titleWidth={titleWidth}
          subtitleWidth={subtitleWidth}
          actionCount={actionCount}
        />
      ) : null}
      {hasTabs ? <TabStripSkeleton count={tabCount} className="mb-4" /> : null}
      {kpiCount > 0 ? (
        <KpiStripSkeleton
          count={kpiCount}
          className="mb-4 md:grid-cols-3 xl:grid-cols-3"
        />
      ) : null}
      {hasDateNav ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-36 rounded-md border border-gray-200 bg-slate-100" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-36 rounded-md border border-gray-200 bg-slate-100" />
        </div>
      ) : null}
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {hasFilter ? <FilterBarSkeleton fields={filterFields} /> : null}
        <TableSkeleton rows={rows} cols={cols} minWidth={minWidth} />
      </section>
    </>
  );

  if (!withShell) {
    return content;
  }

  return <PageShell contentClassName={contentClassName}>{content}</PageShell>;
}

export function CardListPageSkeleton({
  cards = 8,
  grouped = false,
  groups = 2,
  actionCount = 1,
  formRows = 0,
  showHeader = true,
  withShell = true,
  contentClassName,
  cardGridClassName,
}: {
  cards?: number;
  grouped?: boolean;
  groups?: number;
  actionCount?: number;
  formRows?: number;
  showHeader?: boolean;
  withShell?: boolean;
  contentClassName?: string;
  cardGridClassName?: string;
}) {
  const cardGrid = (count: number) => (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
        cardGridClassName,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} rows={4} titleWidth="w-28" />
      ))}
    </div>
  );

  const content = (
    <>
      {showHeader ? <PageHeaderSkeleton actionCount={actionCount} /> : null}
      {grouped ? (
        <div className="space-y-4">
          {Array.from({ length: groups }).map((_, index) => (
            <section
              key={index}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <PanelHeaderSkeleton titleWidth="w-32" />
              <div className="p-3.5">{cardGrid(Math.max(1, cards))}</div>
            </section>
          ))}
        </div>
      ) : (
        cardGrid(cards)
      )}
      {formRows > 0 ? (
        <div className="mt-4 max-w-xl">
          <FormPageSkeleton
            fieldRows={formRows}
            showHeader={false}
            withShell={false}
          />
        </div>
      ) : null}
    </>
  );

  if (!withShell) {
    return content;
  }

  return <PageShell contentClassName={contentClassName}>{content}</PageShell>;
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
      <main className="min-h-screen bg-slate-50 font-jakarta text-slate-900 md:grid md:grid-cols-[45%_55%]">
        <section className="relative hidden overflow-hidden border-r border-gray-200 bg-white px-10 py-9 md:flex md:flex-col md:justify-between lg:px-14">
          <div
            className="absolute inset-x-10 top-9 h-24 rounded-lg border border-gray-100 bg-slate-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(226,232,240,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.6) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-px bg-gray-200"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <Skeleton className="size-10 rounded-md border border-gray-200 bg-slate-100" />
            <div>
              <Skeleton className="h-3 w-24 bg-slate-200" />
              <Skeleton className="mt-2 h-2.5 w-48 bg-slate-100" />
            </div>
          </div>
          <div className="relative max-w-md">
            <Skeleton className="h-3 w-40 bg-slate-200" />
            <Skeleton className="mt-4 h-8 w-80 max-w-full bg-slate-200" />
            <Skeleton className="mt-2 h-8 w-64 max-w-full bg-slate-200" />
            <Skeleton className="mt-5 h-3 w-full bg-slate-100" />
            <Skeleton className="mt-2 h-3 w-4/5 bg-slate-100" />
          </div>
          <div className="relative flex items-center justify-between border-t border-gray-200 pt-5">
            <Skeleton className="h-3 w-28 bg-slate-100" />
            <Skeleton className="h-3 w-36 bg-slate-100" />
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 md:hidden">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-md border border-gray-200 bg-slate-100" />
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-2.5 w-48 max-w-full" />
                </div>
              </div>
            </div>
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <PanelHeaderSkeleton titleWidth="w-20" />
              <div className="px-5 py-6 sm:px-7 sm:py-7">
                <div className="mb-6">
                  <Skeleton className="h-6 w-64 max-w-full" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
                <FieldRowsSkeleton rows={fieldRows} />
                <Skeleton className="mt-5 h-10 w-full rounded-md border border-gray-200 bg-slate-200" />
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton
                        key={index}
                        className="h-9 rounded-md border border-gray-200 bg-slate-100"
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
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <PanelHeaderSkeleton titleWidth="w-36" />
        <div className="px-3.5 py-4">
          <FieldRowsSkeleton rows={fieldRows} />
          <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
            <Skeleton className="h-10 w-32 rounded-md border border-gray-200 bg-slate-200" />
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
  showHeader = true,
  withShell = true,
}: {
  cardCount?: number;
  rowsPerCard?: number;
  hasTabs?: boolean;
  emptyState?: boolean;
  contentClassName?: string;
  showHeader?: boolean;
  withShell?: boolean;
}) {
  if (emptyState) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 p-6 font-jakarta text-slate-900">
        <section className="min-h-[280px] w-full max-w-xl rounded-lg border border-gray-200 bg-white px-6 py-10 shadow-sm">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <Skeleton className="size-12 rounded-lg border border-gray-200 bg-slate-100" />
            <Skeleton className="mt-5 h-6 w-44" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-5/6" />
            <Skeleton className="mt-6 h-10 w-32 rounded-md border border-gray-200 bg-slate-200" />
          </div>
        </section>
      </main>
    );
  }

  const content = (
    <>
      {showHeader ? (
        <PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-56" />
      ) : null}
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
  showHeader = true,
}: {
  summaryCount?: number;
  actionRows?: number;
  showHeader?: boolean;
}) {
  return (
    <PageShell>
      {showHeader ? <PageHeaderSkeleton actionCount={1} /> : null}
      <KpiStripSkeleton count={summaryCount} className="md:grid-cols-3" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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



export function RedirectShellSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-jakarta text-slate-900">
      <section className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md border border-gray-200 bg-slate-100" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
