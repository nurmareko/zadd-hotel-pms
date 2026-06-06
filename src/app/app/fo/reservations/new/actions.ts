"use server";

import {
  Prisma,
  ReservationStatus,
  ReservationUsageType,
  RoomStatus,
} from "@prisma/client";
import { format, formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { dateOnlyBoundary } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { validateRoomTypeCapacity } from "@/lib/reservation-capacity";
import {
  createReservationSchema,
  type CreateReservationValues,
  type EditReservationValues,
  reservationCapacityError,
} from "./schema";

type ReservationActionField = "roomTypeId" | "roomId";
type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: ReservationActionField };

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid reservation data";
}

function isRetryableReservationNumberError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

async function selectedRoomLabel(roomId: number | null) {
  if (roomId === null) {
    return "unallocated reservation";
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { number: true },
  });

  return room?.number ?? String(roomId);
}

async function reservationConflictMessage(roomId: number | null) {
  if (roomId === null) {
    return "Reservation changed while saving. Try again.";
  }

  return `Room ${await selectedRoomLabel(
    roomId,
  )} is no longer available for those dates.`;
}

type ReservationRoomAssignment = {
  roomType: {
    id: number;
    baseRate: Prisma.Decimal;
    capacity: number;
  };
  room: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  } | null;
};

function sameDateOnly(left: Date, right: Date) {
  return (
    formatISO(dateOnlyBoundary(left), { representation: "date" }) ===
    formatISO(dateOnlyBoundary(right), { representation: "date" })
  );
}

async function validateReservationRoomAssignment(
  tx: Prisma.TransactionClient,
  input: CreateReservationValues | EditReservationValues,
  reservationId?: number,
): Promise<
  | { ok: true; assignment: ReservationRoomAssignment }
  | { ok: false; error: string }
> {
  const roomType = await tx.roomType.findUnique({
    where: { id: input.roomTypeId },
    select: {
      id: true,
      baseRate: true,
      capacity: true,
    },
  });

  if (!roomType) {
    return { ok: false, error: "Room type is invalid for this booking" };
  }

  const totalGuests = input.adults + input.children;

  if (totalGuests > roomType.capacity) {
    return {
      ok: false,
      error: reservationCapacityError(totalGuests, roomType.capacity),
    };
  }

  if (input.roomId === null) {
    return { ok: true, assignment: { roomType, room: null } };
  }

  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE
  `;

  const room = await tx.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      number: true,
      roomTypeId: true,
      status: true,
    },
  });

  if (!room || room.roomTypeId !== input.roomTypeId) {
    return { ok: false, error: "Room is invalid for this booking" };
  }

  if (room.status === RoomStatus.OOO) {
    return {
      ok: false,
      error: `Room ${room.number} is out of order. Choose another.`,
    };
  }

  const overlappingReservation = await tx.reservation.findFirst({
    where: {
      ...(reservationId ? { id: { not: reservationId } } : {}),
      roomId: room.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      arrivalDate: { lt: input.departureDate },
      departureDate: { gt: input.arrivalDate },
    },
    select: { id: true },
  });

  if (overlappingReservation) {
    return {
      ok: false,
      error: `Room ${room.number} is no longer available for those dates.`,
    };
  }

  return { ok: true, assignment: { roomType, room } };
}

async function currentReservationSchema() {
  const roomTypes = await prisma.roomType.findMany({
    select: { id: true, capacity: true },
  });

  return createReservationSchema(roomTypes);
}

async function runCreateReservationTransaction(
  input: CreateReservationValues,
  userId: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const validatedAssignment = await validateReservationRoomAssignment(
        tx,
        input,
      );

      if (!validatedAssignment.ok) {
        return validatedAssignment;
      }

      const { roomType, room } = validatedAssignment.assignment;
      const validatedCapacity = await validateRoomTypeCapacity(
        {
          roomTypeId: input.roomTypeId,
          arrival: input.arrivalDate,
          departure: input.departureDate,
        },
        tx,
      );

      if (!validatedCapacity.ok) {
        return validatedCapacity;
      }

      const now = new Date();
      const reservationPrefix = `RSV-${format(now, "yyMMdd")}-`;
      const reservationCount = await tx.reservation.count({
        where: { reservationNo: { startsWith: reservationPrefix } },
      });
      const reservationNo = `${reservationPrefix}${String(
        reservationCount + 1,
      ).padStart(4, "0")}`;

      const guest = await tx.guest.create({
        data: {
          fullName: input.fullName,
          idNumber: input.idNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          nationality: input.nationality,
        },
        select: { id: true },
      });

      const reservation = await tx.reservation.create({
        data: {
          reservationNo,
          type: ReservationUsageType.REGULAR,
          arrangementType: input.arrangementType,
          reservationType: input.reservationType,
          guestId: guest.id,
          roomTypeId: input.roomTypeId,
          roomId: room?.id ?? null,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
          adults: input.adults,
          children: input.children,
          status: ReservationStatus.CONFIRMED,
          rateAmount: roomType.baseRate,
          deposit: input.deposit,
          notes: input.notes,
          createdById: userId,
        },
        select: { id: true },
      });

      return { ok: true as const, reservationId: reservation.id };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function runUpdateReservationTransaction(
  reservationId: number,
  input: EditReservationValues,
) {
  return prisma.$transaction(
    async (tx) => {
      const existingReservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          guestId: true,
          roomTypeId: true,
          arrivalDate: true,
          departureDate: true,
          status: true,
        },
      });

      if (!existingReservation) {
        return { ok: false as const, error: "Reservation not found" };
      }

      if (
        input.roomId === null &&
        existingReservation.status !== ReservationStatus.CONFIRMED
      ) {
        return {
          ok: false as const,
          error: "Room is required after check-in",
        };
      }

      const validatedAssignment = await validateReservationRoomAssignment(
        tx,
        input,
        reservationId,
      );

      if (!validatedAssignment.ok) {
        return validatedAssignment;
      }

      const { roomType, room } = validatedAssignment.assignment;
      const stayChanged =
        existingReservation.roomTypeId !== input.roomTypeId ||
        !sameDateOnly(existingReservation.arrivalDate, input.arrivalDate) ||
        !sameDateOnly(existingReservation.departureDate, input.departureDate);

      if (stayChanged) {
        const validatedCapacity = await validateRoomTypeCapacity(
          {
            roomTypeId: input.roomTypeId,
            arrival: input.arrivalDate,
            departure: input.departureDate,
            excludeReservationId: reservationId,
          },
          tx,
        );

        if (!validatedCapacity.ok) {
          return validatedCapacity;
        }
      }

      await tx.guest.update({
        where: { id: existingReservation.guestId },
        data: {
          fullName: input.fullName,
          idNumber: input.idNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          nationality: input.nationality,
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          roomTypeId: input.roomTypeId,
          roomId: room?.id ?? null,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
          adults: input.adults,
          children: input.children,
          rateAmount: roomType.baseRate,
          deposit: input.deposit,
          notes: input.notes,
          arrangementType: input.arrangementType,
          reservationType: input.reservationType,
        },
      });

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function createReservation(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = (await currentReservationSchema()).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  let result: Awaited<ReturnType<typeof runCreateReservationTransaction>> | null =
    null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCreateReservationTransaction(parsed.data, userId);
      break;
    } catch (error) {
      if (attempt < 2 && isRetryableReservationNumberError(error)) {
        retriedAfterConflict = true;
        continue;
      }

      if (retriedAfterConflict || isSerializationConflict(error)) {
        return {
          ok: false,
          error: await reservationConflictMessage(parsed.data.roomId),
        };
      }

      return { ok: false, error: "Something went wrong creating reservation" };
    }
  }

  if (!result) {
    return { ok: false, error: "Something went wrong creating reservation" };
  }

  if (!result.ok) {
    return result;
  }

  const arrival = formatISO(parsed.data.arrivalDate, { representation: "date" });

  revalidatePath("/app/fo/reservations");
  revalidatePath("/app/fo/tape-chart");
  redirect(`/app/fo/reservations?from=${arrival}&to=${arrival}`);
}

export async function cancelReservation(
  reservationId: number,
): Promise<ActionResult> {
  const session = await auth();

  // Cancel is permitted for FO (who own the screen) and ADMIN.
  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Invalid reservation" };
  }

  let result: { ok: true } | { ok: false; error: string };

  try {
    result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            status: true,
            folio: { select: { id: true } },
          },
        });

        if (!reservation) {
          return { ok: false as const, error: "Reservasi tidak ditemukan" };
        }

        // Re-verify server-side; never trust the client's view of status.
        if (reservation.status !== ReservationStatus.CONFIRMED) {
          return {
            ok: false as const,
            error: "Hanya reservasi berstatus CONFIRMED yang bisa dibatalkan.",
          };
        }

        // A CONFIRMED reservation should have no folio (created at check-in).
        // If one somehow exists, do NOT cancel and do NOT delete it.
        if (reservation.folio) {
          return {
            ok: false as const,
            error:
              "Reservasi ini sudah memiliki folio. Pembatalan dibatalkan; periksa folio terlebih dahulu.",
          };
        }

        const updated = await tx.reservation.updateMany({
          where: { id: reservationId, status: ReservationStatus.CONFIRMED },
          data: { status: ReservationStatus.CANCELLED },
        });

        if (updated.count === 0) {
          return {
            ok: false as const,
            error: "Status reservasi berubah saat membatalkan. Coba lagi.",
          };
        }

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: "Status reservasi berubah saat membatalkan. Coba lagi.",
      };
    }

    return { ok: false, error: "Something went wrong cancelling reservation" };
  }

  if (!result.ok) {
    return result;
  }

  revalidatePath("/app/fo/reservations");
  revalidatePath(`/app/fo/reservations/${reservationId}`);
  revalidatePath("/app/fo/tape-chart");
  return { ok: true };
}

export async function updateReservation(
  reservationId: number,
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Invalid reservation" };
  }

  const parsed = (await currentReservationSchema()).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  let result: Awaited<ReturnType<typeof runUpdateReservationTransaction>> | null =
    null;

  try {
    result = await runUpdateReservationTransaction(reservationId, parsed.data);
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: await reservationConflictMessage(parsed.data.roomId),
      };
    }

    return { ok: false, error: "Something went wrong updating reservation" };
  }

  if (!result.ok) {
    return result;
  }

  revalidatePath("/app/fo/reservations");
  revalidatePath(`/app/fo/reservations/${reservationId}`);
  revalidatePath("/app/fo/tape-chart");
  redirect(`/app/fo/reservations/${reservationId}?mode=view`);
}
