import {
  addDays,
  format,
  formatISO,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { ReservationStatus, type RoomStatus } from "@prisma/client";

import { dateOnlyBoundary } from "@/lib/date-only";
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
  folio: {
    id: number;
  } | null;
};

type FoTapeChartPageProps = {
  searchParams: Promise<{ startDate?: string | string[] }>;
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

function parseStartDate(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return startOfDay(new Date());
  }

  const parsed = parseISO(candidate);

  return isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
}

function getDateHref(startDate: Date) {
  return `/app/fo/tape-chart?startDate=${formatISO(startDate, {
    representation: "date",
  })}`;
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
            folioId: undefined,
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
          folioId: reservation.folio?.id,
          isFirstDayOfStay: dayTime === arrivalTime,
          isLastDayOfStay: dayTime === lastNightTime,
        };
      }),
    };
  });
}

export default async function FoTapeChartPage({
  searchParams,
}: FoTapeChartPageProps) {
  const { startDate } = await searchParams;
  const visibleStartDate = parseStartDate(startDate);
  const days = buildDays(visibleStartDate);
  const gridStartDate = dateOnlyBoundary(visibleStartDate);
  const gridEndDate = addDays(gridStartDate, DAY_COUNT);

  const [rooms, reservations] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        AND: [
          { arrivalDate: { lt: gridEndDate } },
          { departureDate: { gt: gridStartDate } },
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
      include: {
        guest: {
          select: { fullName: true },
        },
        folio: {
          select: { id: true },
        },
      },
      orderBy: [{ arrivalDate: "asc" }, { departureDate: "asc" }],
    }),
  ]);

  const rows = buildRows({ rooms, reservations, days });
  const displayDays = days.map((day) => day.display);
  const previousStartDate = addDays(visibleStartDate, -DAY_COUNT);
  const nextStartDate = addDays(visibleStartDate, DAY_COUNT);
  const rangeStart = format(visibleStartDate, "dd MMM", {
    locale: indonesianLocale,
  });
  const rangeEnd = format(
    addDays(visibleStartDate, DAY_COUNT - 1),
    "dd MMM yyyy",
    {
      locale: indonesianLocale,
    },
  );

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
            <Link
              href={getDateHref(previousStartDate)}
              aria-label="Tanggal sebelumnya"
              className="flex h-8 w-8 items-center justify-center border border-console-border bg-console-surface text-console-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <div className="flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold tracking-[0.04em]">
              <span className="num">
                {rangeStart} – {rangeEnd}
              </span>
            </div>
            <Link
              href={getDateHref(nextStartDate)}
              aria-label="Tanggal berikutnya"
              className="flex h-8 w-8 items-center justify-center border border-console-border bg-console-surface text-console-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <Link
            href="/app/fo/tape-chart"
            className="inline-flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink"
          >
            Hari Ini
          </Link>
          <Link
            href="/app/fo/reservations/new"
            className="flex h-8 items-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Reservasi Baru
          </Link>
        </div>
      </div>

      <TapeChartLegend roomCount={rooms.length} dayCount={displayDays.length} />
      <TapeChartGrid days={displayDays} rows={rows} />
    </main>
  );
}
