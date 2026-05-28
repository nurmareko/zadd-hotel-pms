import { FBOrderStatus, ReservationStatus, RoomStatus } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import Link from "next/link";

import { todayDateOnly } from "@/lib/date-only";
import { formatIDR, formatLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { AuditHistory, type AuditHistoryRow } from "./audit-history";
import { AuditStatusBanner } from "./audit-status-banner";
import { TodaySnapshot, type TodaySnapshotData } from "./today-snapshot";

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
  const timestampToday = startOfDay(new Date());
  const timestampTomorrow = addDays(timestampToday, 1);
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
        postedAt: { gte: timestampToday, lt: timestampTomorrow },
        fbOrderId: null,
      },
      _sum: { amount: true },
    }),
    prisma.fBOrder.aggregate({
      where: {
        status: FBOrderStatus.CLOSED,
        closedAt: { gte: timestampToday, lt: timestampTomorrow },
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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Accounting
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Business date: {dateLabel} · {auditStatusLabel}
          </p>
        </div>
        <Link
          className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AuditHistory rows={historyRows} />
        <aside className="border border-console-border bg-console-surface">
          <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"// RINGKASAN"}
          </div>
          <div className="space-y-2 p-3.5 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Business date</span>
              <span className="num font-semibold">{dateLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Audit hari ini</span>
              <span className="font-semibold uppercase">{auditStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Pendapatan berjalan</span>
              <span className="num font-semibold">
                {formatIDR(runningRevenue)}
              </span>
            </div>
            <div className="border-t border-console-border-soft pt-2 text-[11px] leading-5 text-slate-500">
              Snapshot hari ini dihitung dari data operasional live. Riwayat di
              tabel adalah hasil night audit yang sudah tersimpan.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
