import { ReservationStatus, type RoomStatus } from "@prisma/client";
import { addDateOnlyDays, dateOnlyBoundary, hotelTodayDateOnly } from "@/lib/date-only";
import { formatISODate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { RoomBlockSummary } from "@/lib/room-blocks/overlap";
import { activeRoomBlockWhere } from "@/lib/room-blocks/queries";

const TAPE_CHART_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
] as const;

export type TapeChartReservationData = {
  id: number;
  groupBookingId: string | null;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
};

export type TapeChartRoomBlockData = RoomBlockSummary & { note: string | null };

export type TapeChartRoomData = {
  id: number;
  number: string;
  floor: number;
  status: RoomStatus;
  isBlockedToday: boolean;
  roomBlocks: TapeChartRoomBlockData[];
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
  groupBookingId: string | null;
  arrivalDate: Date;
  departureDate: Date;
  status: ReservationStatus;
  guest: {
    fullName: string;
  };
}): TapeChartReservationData {
  return {
    id: reservation.id,
    groupBookingId: reservation.groupBookingId,
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
  const windowEnd = addDateOnlyDays(windowStart, dayCount);
  const today = hotelTodayDateOnly();

  const [roomTypes, reservations, roomBlocks, blockedRoomsToday] = await Promise.all([
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
        groupBookingId: true,
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
    prisma.roomBlock.findMany({
      where: activeRoomBlockWhere({ range: {
        startDate: windowStart.toISOString().slice(0, 10),
        endDate: windowEnd.toISOString().slice(0, 10),
      } }),
      select: {
        id: true, roomId: true, startDate: true, endDate: true,
        reason: true, status: true, note: true,
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    }),
    // Today's summary must not depend on the navigated chart window.
    prisma.roomBlock.findMany({
      where: activeRoomBlockWhere({ range: {
        startDate: today.toISOString().slice(0, 10),
        endDate: addDateOnlyDays(today, 1).toISOString().slice(0, 10),
      } }),
      select: { roomId: true },
      distinct: ["roomId"],
    }),
  ]);

  const blockedRoomIdsToday = new Set(blockedRoomsToday.map((block) => block.roomId));
  const blocksByRoomId = new Map<number, TapeChartRoomBlockData[]>();
  for (const block of roomBlocks) {
    const existing = blocksByRoomId.get(block.roomId) ?? [];
    existing.push({
      ...block,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
    });
    blocksByRoomId.set(block.roomId, existing);
  }

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
    startDate: windowStart.toISOString().slice(0, 10),
    endDate: windowEnd.toISOString().slice(0, 10),
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
        isBlockedToday: blockedRoomIdsToday.has(room.id),
        roomBlocks: blocksByRoomId.get(room.id) ?? [],
        reservations: reservationsByRoomId.get(room.id) ?? [],
      })),
      unallocatedReservations:
        unallocatedByRoomTypeId.get(roomType.id) ?? [],
    })),
  };
}
