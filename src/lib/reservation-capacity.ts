import { Prisma, ReservationStatus } from "@prisma/client";
import { dateOnlyBoundary } from "@/lib/date-only";
import { computeDailyRoomTypeCapacity } from "@/lib/reservation-capacity-logic";
import { getActiveRoomBlocks } from "@/lib/room-blocks/queries";

export type RoomTypeCapacityInput = {
  roomTypeId: number;
  arrival: Date;
  departure: Date;
  requestedCount?: number;
  excludeReservationId?: number;
};

export type RoomTypeCapacityResult =
  | { ok: true }
  | { ok: false; error: string; field: "roomTypeId" };

export async function validateRoomTypeCapacity(
  {
    roomTypeId,
    arrival,
    departure,
    requestedCount = 1,
    excludeReservationId,
  }: RoomTypeCapacityInput,
  tx: Prisma.TransactionClient,
): Promise<RoomTypeCapacityResult> {
  const arrivalDate = dateOnlyBoundary(arrival);
  const departureDate = dateOnlyBoundary(departure);

  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "room_type" WHERE id = ${roomTypeId} FOR SHARE
  `;

  const roomType = await tx.roomType.findUnique({
    where: { id: roomTypeId },
    select: {
      name: true,
      _count: { select: { rooms: true } },
    },
  });

  if (!roomType) {
    return {
      ok: false,
      field: "roomTypeId",
      error: "Tipe kamar tidak valid untuk reservasi ini.",
    };
  }

  const roomCount = roomType._count.rooms;
  const overlappingReservations = await tx.reservation.findMany({
    where: {
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      roomTypeId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
      arrivalDate: { lt: departureDate },
      departureDate: { gt: arrivalDate },
    },
    select: {
      arrivalDate: true,
      departureDate: true,
    },
  });

  const range = {
    startDate: arrivalDate.toISOString().slice(0, 10),
    endDate: departureDate.toISOString().slice(0, 10),
  };
  const blocks = await getActiveRoomBlocks({ roomTypeId, range }, tx);
  const days = computeDailyRoomTypeCapacity({
    range,
    roomCount,
    blocks,
    reservations: overlappingReservations.map((reservation) => ({
      arrivalDate: reservation.arrivalDate.toISOString().slice(0, 10),
      departureDate: reservation.departureDate.toISOString().slice(0, 10),
    })),
  });

  // Zero checks existing demand after inserting a proposed room block.
  if (!Number.isInteger(requestedCount) || requestedCount < 0 || days.length === 0) {
    return {
      ok: false,
      field: "roomTypeId",
      error: "Jumlah kamar yang diminta tidak valid.",
    };
  }

  const fullDay = days.find((day) => day.available < requestedCount);
  if (fullDay) {
    return {
      ok: false,
      field: "roomTypeId",
      error: `Tipe kamar ${roomType.name} sudah penuh pada tanggal ${fullDay.date}. Kapasitas ${roomCount}, diblokir ${fullDay.blockedCount}, sudah dipesan ${fullDay.reservationCount}, diminta ${requestedCount}.`,
    };
  }

  return { ok: true };
}
