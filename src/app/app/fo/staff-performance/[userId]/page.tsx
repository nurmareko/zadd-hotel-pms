import { addDays, formatDistanceToNow } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import {
  ArrowLeft,
  BedDouble,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactDateTimeID, formatIDR } from "@/lib/format";
import { hotelTodayTimestampRange } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

import {
  actionLabel,
  buildMetrics,
  metadataAmount,
  metadataText,
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
  const days = windowKey === "month" ? 30 : windowKey === "week" ? 7 : 1;
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

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string | number;
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

function reservationNumber(activity: ActivityWithContext) {
  if (activity.reservation) {
    return activity.reservation.reservationNo;
  }

  return activity.reservationId ? `#${activity.reservationId}` : "-";
}

function guestName(activity: ActivityWithContext) {
  return activity.reservation?.guest.fullName ?? "-";
}

function folioNumber(activity: ActivityWithContext) {
  if (activity.folio) {
    return activity.folio.folioNo;
  }

  return activity.folioId ? `#${activity.folioId}` : "-";
}

function roomNumber(activity: ActivityWithContext) {
  if (activity.room) {
    return activity.room.number;
  }

  return activity.roomId ? `#${activity.roomId}` : "-";
}

function activityAmount(activity: ActivityWithContext) {
  const amount = metadataAmount(activity.metadata);

  return amount > 0 ? formatIDR(amount) : "-";
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tunai",
  CARD: "Kartu",
  TRANSFER: "Transfer",
  CHARGE_TO_ROOM: "charge-to-room",
};

function metadataColumn(
  activity: ActivityWithContext,
  key: "method" | "article" | "note",
) {
  const value = metadataText(activity.metadata, key);

  if (!value) {
    return "-";
  }

  return key === "method" ? (paymentMethodLabels[value] ?? value) : value;
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
      <Link
        href="/app/fo/staff-performance"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke laporan perbandingan
      </Link>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={ReceiptText}
          label="Reservasi"
          value={metrics.reservationsCreated}
        />
        <MetricCard
          icon={BedDouble}
          label="Check-in"
          value={metrics.checkInsCompleted}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Check-out"
          value={metrics.checkOutsCompleted}
        />
        <MetricCard
          icon={CreditCard}
          label="Pembayaran"
          value={metrics.paymentsRecordedCount}
        />
        <MetricCard
          icon={FileText}
          label="Charge folio"
          value={metrics.folioChargesPosted}
        />
        <MetricCard
          icon={CalendarClock}
          label="Total aksi"
          value={metrics.totalActions}
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-slate-100">
        </CardHeader>
        <CardContent className="p-0">
          {visibleActivities.length > 0 ? (
            <div className="max-w-full overflow-auto">
              <table className="w-full min-w-[1280px] border-collapse text-sm">
                <caption className="sr-only">
                  Daftar aktivitas petugas, diurutkan dari yang terbaru
                </caption>
                <thead>
                  <tr>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Waktu
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Aksi
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Reservasi
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Tamu
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Folio
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Kamar
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Jumlah
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Metode
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Artikel
                    </th>
                    <th
                      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600"
                      scope="col"
                    >
                      Catatan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(visibleActivities as ActivityWithContext[]).map(
                    (activity) => {
                      return (
                        <tr
                          key={activity.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                        >
                          <td className="w-[180px] px-4 py-3 align-top">
                            <time className="block font-semibold tabular-nums text-slate-900">
                              {formatCompactDateTimeID(activity.createdAt)}
                            </time>
                            <div className="mt-1 text-xs text-slate-500">
                              {relativeTime(activity.createdAt)}
                            </div>
                          </td>
                          <td className="w-[170px] px-4 py-3 align-top font-medium text-slate-900">
                            {actionLabel(activity.action)}
                          </td>
                          <td className="w-[150px] px-4 py-3 align-top font-medium text-slate-950">
                            {reservationNumber(activity)}
                          </td>
                          <td className="w-[180px] px-4 py-3 align-top text-slate-700">
                            {guestName(activity)}
                          </td>
                          <td className="w-[140px] px-4 py-3 align-top text-slate-700">
                            {folioNumber(activity)}
                          </td>
                          <td className="w-[90px] px-4 py-3 align-top text-slate-700">
                            {roomNumber(activity)}
                          </td>
                          <td className="w-[130px] px-4 py-3 text-right align-top font-medium tabular-nums text-slate-900">
                            {activityAmount(activity)}
                          </td>
                          <td className="w-[110px] px-4 py-3 align-top text-slate-700">
                            {metadataColumn(activity, "method")}
                          </td>
                          <td className="w-[130px] px-4 py-3 align-top text-slate-700">
                            {metadataColumn(activity, "article")}
                          </td>
                          <td className="px-4 py-3 align-top text-slate-500">
                            {metadataColumn(activity, "note")}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Belum ada aktivitas dalam rentang ini"
              description="Pilih Sepanjang waktu atau rentang yang lebih luas untuk meninjau riwayat petugas ini."
              className="m-4"
            />
          )}

          {summaryActivities.length > FEED_PAGE_SIZE ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Halaman {page} dari {totalPages}
              </div>
              <div className="flex gap-2">
                {hasPreviousPage ? (
                                  <Link
                                    className={buttonVariants({ variant: "outline" })}
                                    href={historyHref({
                      userId,
                      windowKey,
                      page: page - 1,
                    })}
                  >
                    Lebih baru
                  </Link>
                ) : null}
                {hasNextPage ? (
                                  <Link
                                    className={buttonVariants({ variant: "outline" })}
                                    href={historyHref({
                      userId,
                      windowKey,
                      page: page + 1,
                    })}
                  >
                    Lebih lama
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
