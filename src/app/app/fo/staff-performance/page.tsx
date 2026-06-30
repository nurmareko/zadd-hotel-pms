import { addDays } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ClipboardCheck,
  CreditCard,
  ReceiptText,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCompactDateTimeID,
  formatDateTimeID,
  formatIDR,
} from "@/lib/format";
import { hotelTodayTimestampRange } from "@/lib/date-only";
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
  | "paymentTotal"
  | "charges"
  | "total";
type SortDirection = "asc" | "desc";

type StaffRow = Metrics & {
  id: number;
  username: string;
  fullName: string;
};

const windows: Record<
  WindowKey,
  { label: string; shortLabel: string; days: number }
> = {
  today: { label: "Today", shortLabel: "Today", days: 1 },
  week: { label: "Past Week", shortLabel: "7 days", days: 7 },
  month: { label: "Past Month", shortLabel: "30 days", days: 30 },
};

const sortableColumns: Record<SortKey, string> = {
  staff: "Staff",
  reservations: "Reservations",
  checkIns: "Check-ins",
  checkOuts: "Check-outs",
  payments: "Payments",
  paymentTotal: "Payment Total",
  charges: "Charges",
  total: "Total",
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

function parseSort(value: string | string[] | undefined): SortKey {
  const sortValue = firstParam(value);

  return sortValue && sortValue in sortableColumns
    ? (sortValue as SortKey)
    : "total";
}

function parseDirection(value: string | string[] | undefined): SortDirection {
  return firstParam(value) === "asc" ? "asc" : "desc";
}

function getWindowRange(windowKey: WindowKey) {
  const { start: todayStart, end } = hotelTodayTimestampRange();
  const start = addDays(todayStart, -(windows[windowKey].days - 1));

  return { start, end };
}

function reportHref({
  windowKey,
  sortKey,
  direction,
}: {
  windowKey: WindowKey;
  sortKey?: SortKey;
  direction?: SortDirection;
}) {
  const params = new URLSearchParams({ window: windowKey });

  if (sortKey) {
    params.set("sort", sortKey);
  }

  if (direction) {
    params.set("dir", direction);
  }

  return `/app/fo/staff-performance?${params.toString()}`;
}

function buildRows(
  staffers: Array<{ id: number; username: string; fullName: string }>,
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
    case "paymentTotal":
      return row.paymentsRecordedTotal;
    case "charges":
      return row.folioChargesPosted;
    case "total":
      return row.totalActions;
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
  windowKey,
  align = "right",
}: {
  children: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDirection: SortDirection;
  windowKey: WindowKey;
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
          windowKey,
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

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardDescription className="text-xs font-medium uppercase">
              {label}
            </CardDescription>
            <CardTitle className="mt-1 text-2xl font-semibold tabular-nums">
              {value}
            </CardTitle>
          </div>
          <div className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon className="size-4" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </CardHeader>
    </Card>
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
  const sortKey = parseSort(params.sort);
  const direction = parseDirection(params.dir);
  const { start, end } = getWindowRange(windowKey);

  const [staffers, activities] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { code: "FO" } } },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, username: true, fullName: true },
    }),
    prisma.activityLog.findMany({
      where: {
        createdAt: { gte: start, lt: end },
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
  const totals = rows.reduce(
    (summary, row) => ({
      activeStaff: summary.activeStaff + (row.totalActions > 0 ? 1 : 0),
      totalActions: summary.totalActions + row.totalActions,
      paymentsRecordedCount:
        summary.paymentsRecordedCount + row.paymentsRecordedCount,
      paymentsRecordedTotal:
        summary.paymentsRecordedTotal + row.paymentsRecordedTotal,
    }),
    {
      activeStaff: 0,
      totalActions: 0,
      paymentsRecordedCount: 0,
      paymentsRecordedTotal: 0,
    },
  );
  const topStaff = rows.find((row) => row.totalActions > 0);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
            <BarChart3 className="size-4" aria-hidden="true" />
            Front Office Report
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Staff Performance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ActivityLog-only metrics from {formatDateTimeID(start)} to{" "}
            {formatDateTimeID(end)}.
          </p>
        </div>

        <nav
          aria-label="Performance window"
          className="flex w-full flex-wrap gap-2 sm:w-auto"
        >
          {(Object.keys(windows) as WindowKey[]).map((key) => {
            const active = key === windowKey;

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
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={ClipboardCheck}
          label="Logged actions"
          value={totals.totalActions}
          sub={`${totals.activeStaff} of ${rows.length} FO staff active in this window`}
        />
        <MetricTile
          icon={CreditCard}
          label="Payments"
          value={totals.paymentsRecordedCount}
          sub={formatIDR(totals.paymentsRecordedTotal)}
        />
        <MetricTile
          icon={UserRoundCheck}
          label="Top staff"
          value={topStaff?.fullName ?? "-"}
          sub={
            topStaff
              ? `${topStaff.totalActions} logged actions`
              : "No activity in this window"
          }
        />
        <MetricTile
          icon={ReceiptText}
          label="Window"
          value={windows[windowKey].shortLabel}
          sub={`${formatCompactDateTimeID(start)} - ${formatCompactDateTimeID(end)}`}
        />
      </section>

      <div>
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Comparative table</CardTitle>
            <CardDescription>
              Counts and payment totals are aggregated from ActivityLog rows.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{windows[windowKey].label}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-w-full overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <caption className="sr-only">
                  Front Office staff performance by selected ActivityLog window
                </caption>
                <thead>
                  <tr>
                    <HeaderCell
                      align="left"
                      sortKey="staff"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Staff
                    </HeaderCell>
                    <HeaderCell
                      sortKey="reservations"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Reservations
                    </HeaderCell>
                    <HeaderCell
                      sortKey="checkIns"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Check-ins
                    </HeaderCell>
                    <HeaderCell
                      sortKey="checkOuts"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Check-outs
                    </HeaderCell>
                    <HeaderCell
                      sortKey="payments"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Payments
                    </HeaderCell>
                    <HeaderCell
                      sortKey="paymentTotal"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Payment total
                    </HeaderCell>
                    <HeaderCell
                      sortKey="charges"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Charges
                    </HeaderCell>
                    <HeaderCell
                      sortKey="total"
                      currentSort={sortKey}
                      currentDirection={direction}
                      windowKey={windowKey}
                    >
                      Total
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
                        <td className="px-4 py-3">
                          <Link
                            className="font-semibold text-slate-950 hover:underline"
                            href={href}
                          >
                            {row.fullName}
                          </Link>
                          <div className="mt-0.5 text-xs text-slate-500">
                            @{row.username}
                          </div>
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
                            {formatIDR(row.paymentsRecordedTotal)}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-medium tabular-nums text-slate-900">
                          <Link className="block px-4 py-3" href={href}>
                            {row.folioChargesPosted}
                          </Link>
                        </td>
                        <td className="p-0 text-right font-semibold tabular-nums text-slate-950">
                          <Link className="block px-4 py-3" href={href}>
                            {row.totalActions}
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
