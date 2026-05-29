import { Prisma, ReservationStatus } from "@prisma/client";
import { addDays, formatISO } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";

export type RoomTypeCapacityInput = {
  roomTypeId: number;
  arrival: Date;
  departure: Date;
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
      status: { not: ReservationStatus.CANCELLED },
      arrivalDate: { lt: departureDate },
      departureDate: { gt: arrivalDate },
    },
    select: {
      arrivalDate: true,
      departureDate: true,
    },
  });

  let peakDate = arrivalDate;
  let peakCount = 0;

  for (let date = arrivalDate; date < departureDate; date = addDays(date, 1)) {
    const count = overlappingReservations.filter((reservation) => {
      const reservationArrival = dateOnlyBoundary(reservation.arrivalDate);
      const reservationDeparture = dateOnlyBoundary(reservation.departureDate);

      return reservationArrival <= date && reservationDeparture > date;
    }).length;

    if (count > peakCount) {
      peakCount = count;
      peakDate = date;
    }
  }

  if (peakCount >= roomCount) {
    return {
      ok: false,
      field: "roomTypeId",
      error: `Tipe kamar ${roomType.name} sudah penuh pada tanggal ${formatISO(
        peakDate,
        { representation: "date" },
      )}. Kapasitas ${roomCount}, sudah dipesan ${peakCount}.`,
    };
  }

  return { ok: true };
}
