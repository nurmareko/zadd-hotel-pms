import { addDays } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  hotelTimestampBoundaryForDate,
  hotelTodayTimestampRange,
} from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

import {
  addActivityToMetrics,
  emptyMetrics,
  type ActivityWithContext,
  type Metrics,
} from "./activity";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  window?: string | string[];
  from?: string | string[];
  to?: string | string[];
  sort?: string | string[];
  dir?: string | string[];
}>;

type StaffPerformancePageProps = {
  searchParams: SearchParams;
};

type WindowKey = "today" | "week" | "month";
type SortKey =
  | "staff"
  | "reservations"
  | "checkIns"
  | "checkOuts"
  | "payments"
  | "charges";
type SortDirection = "asc" | "desc";

type StaffRow = Metrics & {
  id: number;
  fullName: string;
};

const windows: Record<WindowKey, { label: string; days: number }> = {
  today: { label: "Today", days: 1 },
  week: { label: "Past Week", days: 7 },
  month: { label: "Past Month", days: 30 },
};

const sortableColumns: Record<SortKey, string> = {
  staff: "Staff",
  reservations: "Reservations",
  checkIns: "Check-ins",
  checkOuts: "Check-outs",
  payments: "Payments",
  charges: "Charges",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseWindow(value: string | string[] | undefined): WindowKey {
  const windowValue = firstParam(value);

  return windowValue === "week" || windowValue === "month"
    ? windowValue
    : "today";
}

function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value && value in sortableColumns);
}

function parseSort(value: string | string[] | undefined): SortKey {
  const sortValue = firstParam(value);

  return isSortKey(sortValue) ? sortValue : "staff";
}

function parseDirection(
  value: string | string[] | undefined,
  sortKey: SortKey,
): SortDirection {
  const direction = firstParam(value);

  if (direction === "asc" || direction === "desc") {
    return direction;
  }

  return sortKey === "staff" ? "asc" : "desc";
}

function parseDateInput(value: string | string[] | undefined) {
  const dateValue = firstParam(value);
  const match = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return dateValue;
}

function getWindowRange(windowKey: WindowKey) {
  const { start: todayStart, end } = hotelTodayTimestampRange();
  const start = addDays(todayStart, -(windows[windowKey].days - 1));

  return { start, end };
}

function getCustomRange(from: string | undefined, to: string | undefined) {
  return {
    start: from ? hotelTimestampBoundaryForDate(from) : undefined,
    end: to ? addDays(hotelTimestampBoundaryForDate(to), 1) : undefined,
  };
}

function activityWindowWhere(range: { start?: Date; end?: Date }) {
  if (!range.start && !range.end) {
    return undefined;
  }

  return {
    ...(range.start ? { gte: range.start } : {}),
    ...(range.end ? { lt: range.end } : {}),
  };
}

function reportHref({
  windowKey,
  from,
  to,
  sortKey,
  direction,
}: {
  windowKey?: WindowKey;
  from?: string;
  to?: string;
  sortKey?: SortKey;
  direction?: SortDirection;
}) {
  const params = new URLSearchParams();

  if (from || to) {
    if (from) {
      params.set("from", from);
    }

    if (to) {
      params.set("to", to);
    }
  } else if (windowKey) {
    params.set("window", windowKey);
  }

  if (sortKey) {
    params.set("sort", sortKey);
  }

  if (direction) {
    params.set("dir", direction);
  }

  return `/app/fo/staff-performance?${params.toString()}`;
}

function buildRows(
  staffers: Array<{ id: number; fullName: string }>,
  activities: ActivityWithContext[],
) {
  const metricsByUser = new Map<number, Metrics>();

  for (const staffer of staffers) {
    metricsByUser.set(staffer.id, { ...emptyMetrics });
  }

  for (const activity of activities) {
    const metrics = metricsByUser.get(activity.userId);

    if (metrics) {
      addActivityToMetrics(metrics, activity);
    }
  }

  return staffers.map((staffer) => ({
    ...staffer,
    ...(metricsByUser.get(staffer.id) ?? emptyMetrics),
  }));
}

function sortRows(rows: StaffRow[], sortKey: SortKey, direction: SortDirection) {
  const sorted = [...rows].sort((first, second) => {
    const comparison =
      sortKey === "staff"
        ? first.fullName.localeCompare(second.fullName)
        : metricValue(first, sortKey) - metricValue(second, sortKey);

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

function metricValue(row: StaffRow, sortKey: SortKey) {
  switch (sortKey) {
    case "reservations":
      return row.reservationsCreated;
    case "checkIns":
      return row.checkInsCompleted;
    case "checkOuts":
      return row.checkOutsCompleted;
    case "payments":
      return row.paymentsRecordedCount;
    case "charges":
      return row.folioChargesPosted;
    case "staff":
      return 0;
  }
}

function sortDirectionForColumn(
  currentSort: SortKey,
  currentDirection: SortDirection,
  column: SortKey,
): SortDirection {
  if (currentSort !== column) {
    return column === "staff" ? "asc" : "desc";
  }

  return currentDirection === "asc" ? "desc" : "asc";
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="size-3.5" aria-hidden="true" />;
  }

  return direction === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden="true" />
  );
}

function HeaderCell({
  children,
  sortKey,
  currentSort,
  currentDirection,
  rangeQuery,
  align = "right",
}: {
  children: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDirection: SortDirection;
  rangeQuery: { windowKey: WindowKey; from?: string; to?: string };
  align?: "left" | "right";
}) {
  const nextDirection = sortDirectionForColumn(
    currentSort,
    currentDirection,
    sortKey,
  );
  const active = currentSort === sortKey;

  return (
    <th
      className={[
        "bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
      scope="col"
    >
      <Link
        className={[
          "inline-flex items-center gap-1.5 hover:text-slate-950",
          align === "right" ? "justify-end" : "",
        ].join(" ")}
        href={reportHref({
          ...rangeQuery,
          sortKey,
          direction: nextDirection,
        })}
      >
        {children}
        <SortIcon active={active} direction={currentDirection} />
      </Link>
    </th>
  );
}

export default async function StaffPerformancePage({
  searchParams,
}: StaffPerformancePageProps) {
  const session = await auth();

  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    redirect("/app/forbidden");
  }

  const params = await searchParams;
  const windowKey = parseWindow(params.window);
  const parsedFrom = parseDateInput(params.from);
  const parsedTo = parseDateInput(params.to);
  const [from, to] =
    parsedFrom && parsedTo && parsedFrom > parsedTo
      ? [parsedTo, parsedFrom]
      : [parsedFrom, parsedTo];
  const requestedSort = firstParam(params.sort);
  const sortKey = parseSort(params.sort);
  const direction = parseDirection(
    isSortKey(requestedSort) ? params.dir : undefined,
    sortKey,
  );
  const customRangeActive = Boolean(from || to);
  const range = customRangeActive
    ? getCustomRange(from, to)
    : getWindowRange(windowKey);
  const rangeQuery = customRangeActive
    ? { windowKey, from, to }
    : { windowKey };
  const createdAt = activityWindowWhere(range);

  const [staffers, activities] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { code: "FO" } } },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.activityLog.findMany({
      where: {
        ...(createdAt ? { createdAt } : {}),
        user: { roles: { some: { role: { code: "FO" } } } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        action: true,
        createdAt: true,
        metadata: true,
        reservationId: true,
        folioId: true,
        roomId: true,
        reservation: {
          select: {
            reservationNo: true,
            guest: { select: { fullName: true } },
          },
        },
        folio: { select: { folioNo: true } },
        room: { select: { number: true } },
      },
    }),
  ]);

  const rows = sortRows(buildRows(staffers, activities), sortKey, direction);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Staff Performance
          </h1>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
          <nav
            aria-label="Performance window"
            className="flex w-full flex-wrap gap-2 sm:w-auto"
          >
            {(Object.keys(windows) as WindowKey[]).map((key) => {
              const active = !customRangeActive && key === windowKey;

              return (
                <Link
                  key={key}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors sm:flex-none",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                  href={reportHref({
                    windowKey: key,
                    sortKey,
                    direction,
                  })}
                >
                  {windows[key].label}
                </Link>
              );
            })}
          </nav>

          <form
            action="/app/fo/staff-performance"
            method="get"
            className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          >
            <input type="hidden" name="sort" value={sortKey} />
            <input type="hidden" name="dir" value={direction} />
            <input
              type="date"
              name="from"
              aria-label="Tanggal mulai"
              defaultValue={from ?? ""}
              className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:w-[140px] sm:flex-none"
            />
            <span className="hidden text-slate-400 sm:inline">-</span>
            <input
              type="date"
              name="to"
              aria-label="Tanggal akhir"
              defaultValue={to ?? ""}
              className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:w-[140px] sm:flex-none"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Search className="size-4" aria-hidden="true" />
              Filter
            </button>
          </form>
        </div>
      </div>

      <div>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="max-w-full overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <caption className="sr-only">
                  Front Office staff performance by selected ActivityLog range
                </caption>
                <thead>
                  <tr>
                    <HeaderCell
                      align="left"
                      sortKey="staff"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Staff
                    </HeaderCell>
                    <HeaderCell
                      sortKey="reservations"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Reservations
                    </HeaderCell>
                    <HeaderCell
                      sortKey="checkIns"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Check-ins
                    </HeaderCell>
                    <HeaderCell
                      sortKey="checkOuts"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Check-outs
                    </HeaderCell>
                    <HeaderCell
                      sortKey="payments"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Payments
                    </HeaderCell>
                    <HeaderCell
                      sortKey="charges"
                      currentSort={sortKey}
                      currentDirection={direction}
                      rangeQuery={rangeQuery}
                    >
                      Charges
                    </HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = `/app/fo/staff-performance/${row.id}`;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                      >
                        <td className="p-0 font-semibold text-slate-950">
                          <Link
                            className="block px-4 py-3 text-slate-950"
                            href={href}
                          >
                            {row.fullName}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.reservationsCreated}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.checkInsCompleted}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.checkOutsCompleted}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.paymentsRecordedCount}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.folioChargesPosted}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
