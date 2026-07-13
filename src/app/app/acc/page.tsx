import { FBOrderStatus, ReservationStatus, RoomStatus } from "@prisma/client";
import Link from "next/link";

import { hotelTodayTimestampRange, todayDateOnly } from "@/lib/date-only";
import { formatIDR, formatLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { AuditHistory, type AuditHistoryRow } from "./audit-history";
import { AuditStatusBanner } from "./audit-status-banner";
import { TodaySnapshot, type TodaySnapshotData } from "./today-snapshot";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function businessDateLabel(date: Date) {
  return formatLongDateID(date);
}

function safePercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export default async function AccountingDashboardPage() {
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
    auditHistory,
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
    prisma.nightAudit.findMany({
      include: { runBy: { select: { fullName: true } } },
      orderBy: { businessDate: "desc" },
      take: 14,
    }),
  ]);

  const runningRevenue =
    Number(folioRevenue._sum.amount ?? 0) +
    Number(closedFbRevenue._sum.total ?? 0);
  const snapshot: TodaySnapshotData = {
    occupancyPercent: safePercent(roomsOccupied, totalRooms),
    roomsOccupied,
    totalRooms,
    inHouseCount,
    checkInCount,
    checkOutCount,
    runningRevenue,
  };
  const historyRows: AuditHistoryRow[] = auditHistory.map((audit) => ({
    id: audit.id,
    businessDate: audit.businessDate,
    status: audit.status,
    runAt: audit.runAt,
    occupancyRate: audit.occupancyRate.toString(),
    roomRevenue: audit.roomRevenue.toString(),
    fbRevenue: audit.fbRevenue.toString(),
    totalRevenue: audit.totalRevenue.toString(),
  }));
  const dateLabel = businessDateLabel(dateOnlyToday);
  const auditStatusLabel = todayAudit ? "Sudah diaudit" : "Belum diaudit";

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
        <Link
          className={buttonVariants()}
          href="/app/acc/night-audit"
        >
          Jalankan Night Audit
        </Link>
      </div>

      <TodaySnapshot snapshot={snapshot} />

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
        <Card className="rounded-lg p-0 h-fit border border-border">
          <CardHeader className="border-b border-border px-5 py-4 rounded-none bg-card">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">Ringkasan</CardTitle>
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
            <div className="border-t border-border pt-3 mt-4 text-xs leading-relaxed text-muted-foreground">
              Snapshot hari ini dihitung dari data operasional live. Riwayat di
              tabel adalah hasil night audit yang sudah tersimpan.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
