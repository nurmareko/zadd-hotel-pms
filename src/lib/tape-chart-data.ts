import { ReservationStatus, type RoomStatus } from "@prisma/client";
import { addDays } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const TAPE_CHART_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
] as const;

export type TapeChartReservationData = {
  id: number;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
};

export type TapeChartRoomData = {
  id: number;
  number: string;
  floor: number;
  status: RoomStatus;
  isOutOfOrder: boolean;
  reservations: TapeChartReservationData[];
};

export type TapeChartRoomTypeData = {
  id: number;
  code: string;
  name: string;
  rooms: TapeChartRoomData[];
  unallocatedReservations: TapeChartReservationData[];
};

export type TapeChartData = {
  startDate: string;
  endDate: string;
  dayCount: number;
  roomTypes: TapeChartRoomTypeData[];
};

function toReservationData(reservation: {
  id: number;
  arrivalDate: Date;
  departureDate: Date;
  status: ReservationStatus;
  guest: {
    fullName: string;
  };
}): TapeChartReservationData {
  return {
    id: reservation.id,
    guestName: reservation.guest.fullName,
    checkInDate: formatISODate(reservation.arrivalDate),
    checkOutDate: formatISODate(reservation.departureDate),
    status: reservation.status,
  };
}

export async function getTapeChartData(
  startDate: Date,
  dayCount: number,
): Promise<TapeChartData> {
  if (!Number.isInteger(dayCount) || dayCount <= 0) {
    throw new Error("dayCount must be a positive integer");
  }

  const windowStart = dateOnlyBoundary(startDate);
  const windowEnd = addDays(windowStart, dayCount);

  const [roomTypes, reservations] = await Promise.all([
    prisma.roomType.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        rooms: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
          },
          orderBy: [{ floor: "asc" }, { number: "asc" }],
        },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: [...TAPE_CHART_RESERVATION_STATUSES] },
        arrivalDate: { lt: windowEnd },
        departureDate: { gt: windowStart },
      },
      select: {
        id: true,
        roomId: true,
        roomTypeId: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        guest: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: [{ arrivalDate: "asc" }, { departureDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const reservationsByRoomId = new Map<number, TapeChartReservationData[]>();
  const unallocatedByRoomTypeId = new Map<number, TapeChartReservationData[]>();

  for (const reservation of reservations) {
    const reservationData = toReservationData(reservation);

    if (reservation.roomId === null) {
      const existing =
        unallocatedByRoomTypeId.get(reservation.roomTypeId) ?? [];
      existing.push(reservationData);
      unallocatedByRoomTypeId.set(reservation.roomTypeId, existing);
      continue;
    }

    const existing = reservationsByRoomId.get(reservation.roomId) ?? [];
    existing.push(reservationData);
    reservationsByRoomId.set(reservation.roomId, existing);
  }

  return {
    startDate: formatISODate(windowStart),
    endDate: formatISODate(windowEnd),
    dayCount,
    roomTypes: roomTypes.map((roomType) => ({
      id: roomType.id,
      code: roomType.code,
      name: roomType.name,
      rooms: roomType.rooms.map((room) => ({
        id: room.id,
        number: room.number,
        floor: room.floor,
        status: room.status,
        isOutOfOrder: room.status === "OOO",
        reservations: reservationsByRoomId.get(room.id) ?? [],
      })),
      unallocatedReservations:
        unallocatedByRoomTypeId.get(roomType.id) ?? [],
    })),
  };
}
