import { ReservationStatus, RoomStatus, type Room } from "@prisma/client";
import Link from "next/link";
import { Fragment } from "react";

import { formatWeekdayLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { StatusPill } from "../room-status-grid";
import { roomStatusLabels } from "../room-status-options";

export const dynamic = "force-dynamic";

type RoomStatusListRow = Pick<Room, "id" | "floor" | "number" | "status"> & {
  roomType: {
    code: string;
    name: string;
  };
  housekeepingLogs: {
    updatedAt: Date;
  }[];
  reservations: {
    guest: {
      fullName: string;
    };
  }[];
};

const statusOrder = [
  RoomStatus.VD,
  RoomStatus.OD,
  RoomStatus.VCU,
  RoomStatus.VC,
  RoomStatus.OC,
  RoomStatus.OOO,
] as const;

const headerCellClass =
  "bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";
const bodyCellClass =
  "border-b border-console-border-soft px-3 py-[9px] align-top";

function relativeDurationLabel(from: Date, to: Date) {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.floor(hours / 24);

  return `${days} hari lalu`;
}

function roomDetailHref(roomId: number) {
  return `/app/hk/rooms/${roomId}`;
}

function groupRowsByStatus(rows: RoomStatusListRow[]) {
  const rowsByStatus = new Map<RoomStatus, RoomStatusListRow[]>(
    statusOrder.map((status) => [status, []]),
  );

  for (const row of rows) {
    rowsByStatus.get(row.status)?.push(row);
  }

  return statusOrder.map((status) => ({
    status,
    rows: rowsByStatus.get(status) ?? [],
  }));
}

export default async function HKRoomStatusListPage() {
  const now = new Date();
  const rooms = await prisma.room.findMany({
    include: {
      roomType: { select: { code: true, name: true } },
      housekeepingLogs: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      reservations: {
        where: { status: ReservationStatus.CHECKED_IN },
        select: { guest: { select: { fullName: true } } },
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { floor: "asc" }, { number: "asc" }],
  });
  const groupedRows = groupRowsByStatus(rooms);

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Room Status
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">
          {formatWeekdayLongDateID(now)} · {rooms.length} rooms
        </p>
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// "}
          HK room status list
        </div>

        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-[12px]">
            <caption className="sr-only">
              Room status list grouped by current housekeeping status
            </caption>
            <thead>
              <tr>
                <th className={headerCellClass} scope="col">
                  Status
                </th>
                <th className={headerCellClass} scope="col">
                  Room
                </th>
                <th className={headerCellClass} scope="col">
                  Occupancy
                </th>
                <th className={headerCellClass} scope="col">
                  Last Activity
                </th>
                <th className={headerCellClass} scope="col">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ status, rows }) => (
                <Fragment key={status}>
                  <tr>
                    <th
                      colSpan={5}
                      scope="colgroup"
                      className="border-y border-console-border bg-[var(--slate-100)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-console-ink"
                    >
                      {roomStatusLabels[status]}
                      <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
                        · {rows.length} rooms
                      </span>
                    </th>
                  </tr>
                  {rows.map((room) => {
                    const currentGuest = room.reservations[0]?.guest.fullName;
                    const latestActivity =
                      room.housekeepingLogs[0]?.updatedAt ?? now;

                    return (
                      <tr
                        key={room.id}
                        className="odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                      >
                        <td className={bodyCellClass}>
                          <StatusPill status={room.status} />
                        </td>
                        <td className={bodyCellClass}>
                          <Link
                            href={roomDetailHref(room.id)}
                            className="num text-[16px] font-bold leading-none text-console-ink hover:text-console-accent"
                          >
                            Kamar {room.number}
                          </Link>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Floor {room.floor} · {room.roomType.code} ·{" "}
                            {room.roomType.name}
                          </div>
                        </td>
                        <td className={bodyCellClass}>
                          {currentGuest ? (
                            <span className="font-semibold text-console-ink">
                              {currentGuest}
                            </span>
                          ) : (
                            <span className="text-[11px] italic text-slate-400">
                              Vacant
                            </span>
                          )}
                        </td>
                        <td className={bodyCellClass}>
                          <span className="num text-[11px] text-slate-500">
                            {relativeDurationLabel(latestActivity, now)}
                          </span>
                        </td>
                        <td className={bodyCellClass}>
                          <Link
                            href={roomDetailHref(room.id)}
                            className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
