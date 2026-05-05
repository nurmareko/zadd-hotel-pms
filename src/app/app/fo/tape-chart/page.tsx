import { addDays, format, startOfDay } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ReservationStatus, type RoomStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { TapeChartGrid, type TapeChartRow } from "./tape-chart-grid";
import { TapeChartLegend } from "./tape-chart-legend";

export const dynamic = "force-dynamic";

const DAY_COUNT = 14;
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type TapeChartDay = {
  iso: string;
  dayOfWeek: string;
  dayNumber: string;
};

type ReservationForGrid = {
  id: number;
  roomId: number | null;
  arrivalDate: Date;
  departureDate: Date;
  guest: {
    fullName: string;
  };
};

function getGuestLabel(fullName: string) {
  const [firstName, ...remainingNames] = fullName.trim().split(/\s+/);
  const lastName = remainingNames.at(-1);

  if (!firstName) {
    return "Guest";
  }

  return lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
}

function overlapsStay(reservation: ReservationForGrid, day: Date) {
  const dayTime = startOfDay(day).getTime();
  const arrivalTime = startOfDay(reservation.arrivalDate).getTime();
  const departureTime = startOfDay(reservation.departureDate).getTime();

  return arrivalTime <= dayTime && departureTime > dayTime;
}

function getIdleRoomStatus(status: RoomStatus) {
  if (status === "OC") {
    return "VC";
  }

  if (status === "OD") {
    return "VD";
  }

  return status;
}

function buildDays(today: Date) {
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const day = addDays(today, index);

    return {
      date: day,
      display: {
        iso: format(day, "yyyy-MM-dd"),
        dayOfWeek: DAY_LABELS[day.getDay()],
        dayNumber: format(day, "d"),
      },
    };
  });
}

function buildRows({
  rooms,
  reservations,
  days,
}: {
  rooms: Array<{
    id: number;
    number: string;
    status: RoomStatus;
    roomType: {
      code: string;
    };
  }>;
  reservations: ReservationForGrid[];
  days: Array<{ date: Date; display: TapeChartDay }>;
}): TapeChartRow[] {
  const reservationsByRoomId = new Map<number, ReservationForGrid[]>();

  for (const reservation of reservations) {
    if (!reservation.roomId) {
      continue;
    }

    const existing = reservationsByRoomId.get(reservation.roomId) ?? [];
    existing.push(reservation);
    reservationsByRoomId.set(reservation.roomId, existing);
  }

  return rooms.map((room) => {
    const roomReservations = reservationsByRoomId.get(room.id) ?? [];

    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeLabel: room.roomType.code,
      cells: days.map(({ date, display }) => {
        const reservation = roomReservations.find((candidate) =>
          overlapsStay(candidate, date),
        );

        if (!reservation) {
          return {
            dayIso: display.iso,
            status: getIdleRoomStatus(room.status),
            guestLabel: undefined,
            reservationId: undefined,
            isFirstDayOfStay: false,
            isLastDayOfStay: false,
          };
        }

        const arrivalTime = startOfDay(reservation.arrivalDate).getTime();
        const lastNightTime = startOfDay(
          addDays(reservation.departureDate, -1),
        ).getTime();
        const dayTime = startOfDay(date).getTime();

        return {
          dayIso: display.iso,
          status: "OC" as const,
          guestLabel: getGuestLabel(reservation.guest.fullName),
          reservationId: reservation.id,
          isFirstDayOfStay: dayTime === arrivalTime,
          isLastDayOfStay: dayTime === lastNightTime,
        };
      }),
    };
  });
}

export default async function FoTapeChartPage() {
  const today = startOfDay(new Date());
  const days = buildDays(today);
  const gridEndDate = addDays(today, DAY_COUNT);

  const [rooms, reservations] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        AND: [
          { arrivalDate: { lt: gridEndDate } },
          { departureDate: { gt: today } },
          {
            status: {
              in: [
                ReservationStatus.CHECKED_IN,
                ReservationStatus.CONFIRMED,
              ],
            },
          },
        ],
      },
      include: { guest: true },
      orderBy: [{ arrivalDate: "asc" }, { departureDate: "asc" }],
    }),
  ]);

  const rows = buildRows({ rooms, reservations, days });
  const displayDays = days.map((day) => day.display);
  const rangeStart = format(today, "d MMM", { locale: indonesianLocale });
  const rangeEnd = format(addDays(today, DAY_COUNT - 1), "d MMM yyyy", {
    locale: indonesianLocale,
  });

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Tape Chart
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Klik sel kosong untuk membuat reservasi · Klik sel terisi untuk
            membuka folio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Tanggal sebelumnya"
              className="flex h-8 w-8 items-center justify-center border border-console-border bg-console-surface text-console-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <div className="flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em]">
              <span className="num">
                {rangeStart} - {rangeEnd}
              </span>
            </div>
            <button
              type="button"
              aria-label="Tanggal berikutnya"
              className="flex h-8 w-8 items-center justify-center border border-console-border bg-console-surface text-console-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="h-8 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink"
          >
            Hari Ini
          </button>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Reservasi Baru
          </button>
        </div>
      </div>

      <TapeChartLegend roomCount={rooms.length} dayCount={displayDays.length} />
      <TapeChartGrid days={displayDays} rows={rows} />
    </main>
  );
}
