import { addDays, formatDistanceToNow } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import {
  ArrowLeft,
  BedDouble,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  ListChecks,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactDateTimeID, formatDateTimeID, formatIDR } from "@/lib/format";
import { hotelTodayTimestampRange } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

import {
  actionBadgeClass,
  actionLabel,
  activityContext,
  activityDetail,
  buildMetrics,
  type ActivityWithContext,
} from "../activity";

export const dynamic = "force-dynamic";

const FEED_PAGE_SIZE = 25;

type HistoryWindowKey = "all" | "month" | "week" | "today";

type StaffHistoryPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    window?: string | string[];
    page?: string | string[];
  }>;
};

const historyWindows: Record<
  HistoryWindowKey,
  { label: string; description: string; days?: number }
> = {
  all: {
    label: "All time",
    description: "Complete ActivityLog history",
  },
  month: {
    label: "Past Month",
    description: "ActivityLog rows from the last 30 hotel days",
    days: 30,
  },
  week: {
    label: "Past Week",
    description: "ActivityLog rows from the last 7 hotel days",
    days: 7,
  },
  today: {
    label: "Today",
    description: "ActivityLog rows from the current hotel day",
    days: 1,
  },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseUserId(value: string) {
  const userId = Number(value);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function parseWindow(value: string | string[] | undefined): HistoryWindowKey {
  const windowValue = firstParam(value);

  return windowValue === "today" ||
    windowValue === "week" ||
    windowValue === "month"
    ? windowValue
    : "all";
}

function parsePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value));

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getHistoryRange(windowKey: HistoryWindowKey) {
  if (windowKey === "all") {
    return null;
  }

  const { start: todayStart, end } = hotelTodayTimestampRange();
  const days = historyWindows[windowKey].days ?? 1;
  const start = addDays(todayStart, -(days - 1));

  return { start, end };
}

function historyHref({
  userId,
  windowKey,
  page,
}: {
  userId: number;
  windowKey: HistoryWindowKey;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (windowKey !== "all") {
    params.set("window", windowKey);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return `/app/fo/staff-performance/${userId}${query ? `?${query}` : ""}`;
}

function activityWhere(
  userId: number,
  range: ReturnType<typeof getHistoryRange>,
): Prisma.ActivityLogWhereInput {
  return {
    userId,
    ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
  };
}

function roleLabel(code: string) {
  return code === "FO" ? "Front Office" : code;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ClipboardCheck;
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

function relativeTime(date: Date) {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: indonesianLocale,
  });
}

export default async function StaffHistoryPage({
  params,
  searchParams,
}: StaffHistoryPageProps) {
  const session = await auth();

  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    redirect("/app/forbidden");
  }

  const [{ userId: userIdParam }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const userId = parseUserId(userIdParam);

  if (!userId) {
    notFound();
  }

  const windowKey = parseWindow(query.window);
  const page = parsePage(query.page);
  const range = getHistoryRange(windowKey);
  const where = activityWhere(userId, range);
  const skip = (page - 1) * FEED_PAGE_SIZE;

  const [staffer, summaryActivities, feedActivities] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: userId,
        roles: { some: { role: { code: "FO" } } },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        roles: {
          select: { role: { select: { code: true, name: true } } },
          orderBy: { role: { code: "asc" } },
        },
      },
    }),
    prisma.activityLog.findMany({
      where,
      select: {
        action: true,
        metadata: true,
      },
    }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: FEED_PAGE_SIZE + 1,
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

  if (!staffer) {
    notFound();
  }

  const roleCode = staffer.roles[0]?.role.code ?? "FO";
  const metrics = buildMetrics(summaryActivities);
  const visibleActivities = feedActivities.slice(0, FEED_PAGE_SIZE);
  const hasNextPage = feedActivities.length > FEED_PAGE_SIZE;
  const hasPreviousPage = page > 1;
  const totalPages = Math.max(
    1,
    Math.ceil(summaryActivities.length / FEED_PAGE_SIZE),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/app/fo/staff-performance"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to comparative report
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-slate-500">
            <ListChecks className="size-4" aria-hidden="true" />
            Staff Activity History
            <Badge variant="outline">{roleLabel(roleCode)}</Badge>
            {!staffer.isActive ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            {staffer.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            @{staffer.username} · {historyWindows[windowKey].description}
          </p>
        </div>

        <nav
          aria-label="History window"
          className="flex w-full flex-wrap gap-2 sm:w-auto"
        >
          {(Object.keys(historyWindows) as HistoryWindowKey[]).map((key) => {
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
                href={historyHref({ userId, windowKey: key })}
              >
                {historyWindows[key].label}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={ReceiptText}
          label="Reservations"
          value={metrics.reservationsCreated}
          sub="Created by this staffer"
        />
        <MetricCard
          icon={BedDouble}
          label="Check-ins"
          value={metrics.checkInsCompleted}
          sub="Completed check-ins"
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Check-outs"
          value={metrics.checkOutsCompleted}
          sub="Completed check-outs"
        />
        <MetricCard
          icon={CreditCard}
          label="Payments"
          value={metrics.paymentsRecordedCount}
          sub={formatIDR(metrics.paymentsRecordedTotal)}
        />
        <MetricCard
          icon={FileText}
          label="Charges"
          value={metrics.folioChargesPosted}
          sub="Folio charges posted"
        />
        <MetricCard
          icon={CalendarClock}
          label="Total actions"
          value={metrics.totalActions}
          sub={
            range
              ? `${formatDateTimeID(range.start)} - ${formatDateTimeID(range.end)}`
              : "All logged time"
          }
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>
            Newest first · {summaryActivities.length} ActivityLog row
            {summaryActivities.length === 1 ? "" : "s"} in this window
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {visibleActivities.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {(visibleActivities as ActivityWithContext[]).map((activity) => {
                const context = activityContext(activity);
                const detail = activityDetail(activity);

                return (
                  <article
                    key={activity.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[180px_minmax(0,1fr)]"
                  >
                    <div>
                      <time className="block text-sm font-semibold tabular-nums text-slate-900">
                        {formatCompactDateTimeID(activity.createdAt)}
                      </time>
                      <div className="mt-1 text-xs text-slate-500">
                        {relativeTime(activity.createdAt)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={actionBadgeClass(activity.action)}
                        >
                          {actionLabel(activity.action)}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-950">
                        {context || "No linked reservation, folio, or room"}
                      </div>
                      {detail ? (
                        <div className="mt-1 text-sm text-slate-500">
                          {detail}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No activity in this window"
              description="Choose All time or a wider window to review this staffer's history."
              className="m-4"
            />
          )}

          {summaryActivities.length > FEED_PAGE_SIZE ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                {hasPreviousPage ? (
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    href={historyHref({
                      userId,
                      windowKey,
                      page: page - 1,
                    })}
                  >
                    Newer
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    href={historyHref({
                      userId,
                      windowKey,
                      page: page + 1,
                    })}
                  >
                    Older
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
