"use server";

import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { format, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CheckInSchema, type CheckInValues } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid check-in data";
}

function isRetryableFolioNumberError(error: unknown) {
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

async function roomUnavailableMessage(roomId: number) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { number: true },
  });

  return `Room ${room?.number ?? roomId} is no longer available - someone else booked it. Choose another.`;
}

async function runCheckInTransaction(input: CheckInValues, userId: number) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "reservation" WHERE id = ${input.reservationId} FOR UPDATE
      `;

      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          id: true,
          roomTypeId: true,
          arrivalDate: true,
          departureDate: true,
          status: true,
        },
      });

      if (!reservation || reservation.status !== ReservationStatus.CONFIRMED) {
        return {
          ok: false as const,
          error: "Reservation is not in confirmable state",
        };
      }

      if (startOfDay(reservation.arrivalDate) > startOfDay(new Date())) {
        return {
          ok: false as const,
          error: "Arrival date is not eligible for check-in yet",
        };
      }

      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE
      `;

      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: { id: true, number: true, roomTypeId: true, status: true },
      });

      if (!room || room.roomTypeId !== reservation.roomTypeId) {
        return { ok: false as const, error: "Room is invalid for this booking" };
      }

      if (room.status === RoomStatus.OOO) {
        return {
          ok: false as const,
          error: `Room ${room.number} is out of order. Choose another.`,
        };
      }

      const overlappingReservation = await tx.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: room.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          arrivalDate: { lt: reservation.departureDate },
          departureDate: { gt: reservation.arrivalDate },
        },
        select: { id: true },
      });

      if (overlappingReservation) {
        return {
          ok: false as const,
          error: `Room ${room.number} is no longer available - someone else booked it. Choose another.`,
        };
      }

      const now = new Date();
      const folioPrefix = `FOL-${format(now, "ddMM")}-`;
      const folioCount = await tx.folio.count({
        where: { folioNo: { startsWith: folioPrefix } },
      });
      const folioNo = `${folioPrefix}${String(folioCount + 1).padStart(4, "0")}`;

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CHECKED_IN,
          roomId: room.id,
          grcFilledAt: now,
          purposeOfVisit: input.grcPurposeOfVisit,
          deposit: input.depositAmount,
        },
      });

      const folio = await tx.folio.create({
        data: {
          folioNo,
          reservationId: reservation.id,
          status: "OPEN",
          openedAt: now,
        },
        select: { id: true },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OC },
      });

      if (input.depositAmount > 0 && input.depositMethod) {
        await tx.payment.create({
          data: {
            folioId: folio.id,
            amount: input.depositAmount,
            method: input.depositMethod,
            reference: input.depositReference,
            receivedById: userId,
            receivedAt: now,
          },
        });
      }

      return { ok: true as const, folioId: folio.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function completeCheckIn(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CheckInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  let result: Awaited<ReturnType<typeof runCheckInTransaction>> | null = null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCheckInTransaction(parsed.data, userId);
      break;
    } catch (error) {
      if (attempt < 2 && isRetryableFolioNumberError(error)) {
        retriedAfterConflict = true;
        continue;
      }

      if (retriedAfterConflict || isSerializationConflict(error)) {
        return {
          ok: false,
          error: await roomUnavailableMessage(parsed.data.roomId),
        };
      }

      return { ok: false, error: "Something went wrong completing check-in" };
    }
  }

  if (!result) {
    return { ok: false, error: "Something went wrong completing check-in" };
  }

  if (!result.ok) {
    return result;
  }

  revalidatePath("/app/fo/tape-chart");
  revalidatePath("/app/fo/reservations");
  revalidatePath(`/app/fo/reservations/${parsed.data.reservationId}`);
  redirect(`/app/fo/folios/${result.folioId}`);
}
