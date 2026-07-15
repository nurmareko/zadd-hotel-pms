import { FBOrderStatus, ReservationStatus, RoomStatus } from "@prisma/client";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeArr, getArrCutover, inclusiveArrRange } from "@/lib/arr";
import {
  addDateOnlyDays,
  hotelTodayTimestampRange,
  todayDateOnly,
} from "@/lib/date-only";
import {
  formatCompactDateID,
  formatIDR,
  formatLongDateID,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { ArrRangeCard } from "./arr-range-card";
import { toArrDisplayData } from "./arr-display";
import { AuditHistory, type AuditHistoryRow } from "./audit-history";
import { AuditStatusBanner } from "./audit-status-banner";
import { TodaySnapshot, type TodaySnapshotData } from "./today-snapshot";

export const dynamic = "force-dynamic";

type DashboardSearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function safePercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export default async function AccountingDashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const query = await searchParams;
  const requestedFrom = firstValue(query.from);
  const requestedTo = firstValue(query.to);
  const hasExplicitRange = requestedFrom !== undefined || requestedTo !== undefined;
  const { start: timestampStart, end: timestampEnd } =
    hotelTodayTimestampRange();
  const { today: dateOnlyToday, tomorrow: dateOnlyTomorrow } = todayDateOnly();

  const [
    totalRooms,
    roomsOccupied,
    inHouseCount,
    checkInCount,
    checkOutCount,
    folioRevenue,
    closedFbRevenue,
    todayAudit,
    latestCompletedAudit,
    cutover,
  ] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({
      where: { status: { in: [RoomStatus.OC, RoomStatus.OD] } },
    }),
    prisma.reservation.count({
      where: { status: ReservationStatus.CHECKED_IN },
    }),
    prisma.reservation.count({
      where: {
        arrivalDate: { gte: dateOnlyToday, lt: dateOnlyTomorrow },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.reservation.count({
      where: {
        departureDate: { gte: dateOnlyToday, lt: dateOnlyTomorrow },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.folioLineItem.aggregate({
      where: {
        postedAt: { gte: timestampStart, lt: timestampEnd },
        fbOrderId: null,
      },
      _sum: { amount: true },
    }),
    prisma.fBOrder.aggregate({
      where: {
        status: FBOrderStatus.CLOSED,
        closedAt: { gte: timestampStart, lt: timestampEnd },
      },
      _sum: { total: true },
    }),
    prisma.nightAudit.findUnique({
      where: { businessDate: dateOnlyToday },
      include: { runBy: { select: { fullName: true } } },
    }),
    prisma.nightAudit.findFirst({
      orderBy: { businessDate: "desc" },
      select: { businessDate: true },
    }),
    getArrCutover(),
  ]);

  const latestBusinessDate = latestCompletedAudit?.businessDate ?? dateOnlyToday;
  const monthStart = new Date(
    `${dateKey(latestBusinessDate).slice(0, 7)}-01T00:00:00.000Z`,
  );
  const defaultFrom =
    cutover.ok && cutover.date > monthStart && cutover.date <= latestBusinessDate
      ? cutover.date
      : monthStart;
  const defaultFromValue = dateKey(defaultFrom);
  const defaultToValue = dateKey(latestBusinessDate);
  let fromValue = requestedFrom ?? defaultFromValue;
  let toValue = requestedTo ?? defaultToValue;
  let validationError: string | undefined;
  let rangeBoundaries: { fromInclusive: Date; toExclusive: Date };

  try {
    rangeBoundaries = inclusiveArrRange(fromValue, toValue);
  } catch {
    validationError =
      "Rentang tanggal tidak valid. Tanggal akhir harus sama atau setelah tanggal awal.";
    fromValue = defaultFromValue;
    toValue = defaultToValue;
    rangeBoundaries = inclusiveArrRange(fromValue, toValue);
  }

  const auditHistory = await prisma.nightAudit.findMany({
    where: {
      businessDate: {
        gte: rangeBoundaries.fromInclusive,
        lt: rangeBoundaries.toExclusive,
      },
    },
    orderBy: { businessDate: "desc" },
  });
  const [rangeArr, latestArr, ...dailyArrResults] = await Promise.all([
    computeArr({ ...rangeBoundaries, resolvedCutover: cutover }),
    computeArr({
      fromInclusive: latestBusinessDate,
      toExclusive: addDateOnlyDays(latestBusinessDate, 1),
      resolvedCutover: cutover,
    }),
    ...auditHistory.map((audit) =>
      computeArr({
        fromInclusive: audit.businessDate,
        toExclusive: addDateOnlyDays(audit.businessDate, 1),
        resolvedCutover: cutover,
      }),
    ),
  ]);

  const runningRevenue =
    Number(folioRevenue._sum.amount ?? 0) +
    Number(closedFbRevenue._sum.total ?? 0);
  const latestArrValue =
    latestArr.status === "AUTHORITATIVE" && latestArr.arr
      ? formatIDR(latestArr.arr.toString())
      : latestArr.status === "NO_RECOGNIZED_NIGHTS"
        ? "N/A"
        : latestArr.status === "INTEGRITY_ERROR"
          ? "Error"
          : "—";
  const snapshot: TodaySnapshotData = {
    occupancyPercent: safePercent(roomsOccupied, totalRooms),
    roomsOccupied,
    totalRooms,
    inHouseCount,
    checkInCount,
    checkOutCount,
    runningRevenue,
    latestCompletedArr: latestArrValue,
    latestCompletedArrCoverage: `${formatCompactDateID(latestBusinessDate)} · ${latestArr.paidRoomNights} paid room nights`,
  };
  const historyRows: AuditHistoryRow[] = auditHistory.map((audit, index) => ({
    id: audit.id,
    businessDate: audit.businessDate,
    status: audit.status,
    runAt: audit.runAt,
    occupancyRate: audit.occupancyRate.toString(),
    roomRevenue: audit.roomRevenue.toString(),
    arr: dailyArrResults[index]?.arr?.toString() ?? null,
    arrAvailability: dailyArrResults[index]?.status ?? "INTEGRITY_ERROR",
    arrReason:
      dailyArrResults[index]?.reason ?? "Daily ARR result was not returned.",
    fbRevenue: audit.fbRevenue.toString(),
    totalRevenue: audit.totalRevenue.toString(),
  }));
  const dateLabel = formatLongDateID(dateOnlyToday);
  const auditStatusLabel = todayAudit ? "Sudah diaudit" : "Belum diaudit";
  const coverageLabel = hasExplicitRange
    ? `ARR rentang ${formatCompactDateID(rangeBoundaries.fromInclusive)}–${formatCompactDateID(addDateOnlyDays(rangeBoundaries.toExclusive, -1))}`
    : defaultFrom > monthStart
      ? `ARR sejak cutover, ${formatCompactDateID(defaultFrom)}–${formatCompactDateID(latestBusinessDate)}`
      : `ARR MTD, ${formatCompactDateID(defaultFrom)}–${formatCompactDateID(latestBusinessDate)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Accounting</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Business date: {dateLabel} · {auditStatusLabel}
          </p>
        </div>
        <Link className={buttonVariants()} href="/app/acc/night-audit">
          Jalankan Night Audit
        </Link>
      </div>

      <TodaySnapshot snapshot={snapshot} />
      <ArrRangeCard
        coverageLabel={coverageLabel}
        fromValue={fromValue}
        result={toArrDisplayData(rangeArr)}
        toValue={toValue}
        validationError={validationError}
      />

      <div className="mt-4">
        <AuditStatusBanner
          businessDateLabel={dateLabel}
          todayAudit={
            todayAudit
              ? {
                  id: todayAudit.id,
                  runAt: todayAudit.runAt,
                  runByName: todayAudit.runBy.fullName,
                }
              : null
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AuditHistory rows={historyRows} />
        <Card className="h-fit rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Ringkasan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Business date</span>
              <span className="num font-semibold text-foreground">{dateLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Audit hari ini</span>
              <span className="font-semibold text-foreground">{auditStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pendapatan berjalan</span>
              <span className="num font-semibold text-foreground">
                {formatIDR(runningRevenue)}
              </span>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              Snapshot hari ini dihitung dari data operasional live. ARR hanya membaca posted per-night room-charge lines; riwayat audit tetap menampilkan snapshot tersimpan untuk metrik non-ARR.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
