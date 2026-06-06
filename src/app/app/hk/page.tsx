import { ReservationStatus, RoomStatus } from "@prisma/client";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { formatWeekdayLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import {
  HKDashboardTabs,
  type CleaningQueueRow,
} from "./cleaning-queue";
import { KpiCard } from "./kpi-card";
import type { RoomStatusGridFloor } from "./room-status-grid";

export const dynamic = "force-dynamic";

const queueStatuses = [RoomStatus.VD, RoomStatus.OD, RoomStatus.VCU] as const;
const displayQueueLimit = 10;

function relativeDurationLabel(from: Date, to: Date, withAgo = false) {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes} menit${withAgo ? " lalu" : ""}`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam${withAgo ? " lalu" : ""}`;
  }

  const days = Math.floor(hours / 24);

  return `${days} hari${withAgo ? " lalu" : ""}`;
}

function actionLabelForStatus(status: RoomStatus) {
  return status === RoomStatus.VCU ? "Inspeksi" : "Mulai";
}

function roomDetailHref(roomId: number) {
  return `/app/hk/rooms/${roomId}`;
}

export default async function HKDashboardPage() {
  const now = new Date();

  const [session, rooms, activeCleaningCount, queueRooms] = await Promise.all([
    auth(),
    prisma.room.findMany({
      include: {
        roomType: true,
        housekeepingLogs: { orderBy: { updatedAt: "desc" }, take: 1 },
        reservations: {
          where: { status: ReservationStatus.CHECKED_IN },
          select: { id: true, notes: true },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
    prisma.cleaningSession.count({
      where: {
        startedAt: { not: null },
        finishedAt: null,
      },
    }),
    prisma.room.findMany({
      where: { status: { in: [...queueStatuses] } },
      include: {
        roomType: true,
        housekeepingLogs: { orderBy: { updatedAt: "desc" }, take: 1 },
        reservations: {
          where: { status: ReservationStatus.CHECKED_IN },
          select: { departureDate: true, notes: true },
          orderBy: { departureDate: "asc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
  ]);
  const canOverrideStatus = Boolean(
    session?.user &&
      (session.user.role === "ADMIN" || isHkSupervisor(session)),
  );

  const dirtyCount = rooms.filter(
    (room) => room.status === RoomStatus.VD || room.status === RoomStatus.OD,
  ).length;
  const uncheckedCount = rooms.filter(
    (room) => room.status === RoomStatus.VCU,
  ).length;
  const readyCount = rooms.filter((room) => room.status === RoomStatus.VC).length;

  const queueRows: CleaningQueueRow[] = queueRooms
    .map((room) => {
      const latestLog = room.housekeepingLogs[0];
      const statusSince = latestLog?.updatedAt ?? now;
      const activeReservation = room.reservations[0];

      return {
        id: room.id,
        number: room.number,
        roomTypeName: room.roomType.name,
        status: room.status as CleaningQueueRow["status"],
        timeInStatusLabel: relativeDurationLabel(statusSince, now),
        note: activeReservation?.notes ?? null,
        actionLabel: actionLabelForStatus(room.status),
        href: roomDetailHref(room.id),
        priorityTime: activeReservation?.departureDate.getTime() ?? Infinity,
        statusAge: now.getTime() - statusSince.getTime(),
      };
    })
    .sort((first, second) => {
      if (first.priorityTime !== second.priorityTime) {
        return first.priorityTime - second.priorityTime;
      }

      return second.statusAge - first.statusAge;
    })
    .slice(0, displayQueueLimit)
    .map((row) => ({
      id: row.id,
      number: row.number,
      roomTypeName: row.roomTypeName,
      status: row.status,
      timeInStatusLabel: row.timeInStatusLabel,
      actionLabel: row.actionLabel,
      href: row.href,
      note: row.note,
    }));

  const floorsByNumber = new Map<number, RoomStatusGridFloor["rooms"]>();

  for (const room of rooms) {
    const latestLog = room.housekeepingLogs[0];
    const lastActivity = latestLog?.updatedAt ?? now;
    const floorRooms = floorsByNumber.get(room.floor) ?? [];

    floorRooms.push({
      id: room.id,
      number: room.number,
      status: room.status,
      isOccupied: room.reservations.length > 0,
      lastActivityLabel: relativeDurationLabel(lastActivity, now, true),
      href: roomDetailHref(room.id),
    });
    floorsByNumber.set(room.floor, floorRooms);
  }

  const floors: RoomStatusGridFloor[] = [...floorsByNumber.entries()]
    .sort(([firstFloor], [secondFloor]) => firstFloor - secondFloor)
    .map(([floor, floorRooms]) => ({ floor, rooms: floorRooms }));

  const dashboardDateLabel = formatWeekdayLongDateID(now);

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Dashboard Housekeeping
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">
          {dashboardDateLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="DIRTY"
          value={dirtyCount}
          sub="perlu pembersihan"
        />
        <KpiCard
          label="CLEANING"
          value={activeCleaningCount}
          sub="sedang dibersihkan"
        />
        <KpiCard
          label="UNCHECKED"
          value={uncheckedCount}
          sub="menunggu inspeksi"
        />
        <KpiCard label="READY" value={readyCount} sub="siap untuk tamu" />
      </div>

      <HKDashboardTabs
        queueRows={queueRows}
        floors={floors}
        canOverrideStatus={canOverrideStatus}
      />
    </main>
  );
}
