"use server";

import {
  Prisma,
  ReservationStatus,
  ReservationType,
  RoomStatus,
} from "@prisma/client";
import { format, formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CreateReservationSchema,
  type CreateReservationValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

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

async function selectedRoomLabel(roomId: number) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { number: true },
  });

  return room?.number ?? String(roomId);
}

async function runCreateReservationTransaction(
  input: CreateReservationValues,
  userId: number,
) {
  return prisma.$transaction(
    async (tx) => {
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
          roomType: {
            select: {
              baseRate: true,
            },
          },
        },
      });

      if (!room || room.roomTypeId !== input.roomTypeId) {
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
          roomId: room.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          arrivalDate: { lt: input.departureDate },
          departureDate: { gt: input.arrivalDate },
        },
        select: { id: true },
      });

      if (overlappingReservation) {
        return {
          ok: false as const,
          error: `Room ${room.number} is no longer available for those dates.`,
        };
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
          type: ReservationType.REGULAR,
          guestId: guest.id,
          roomTypeId: input.roomTypeId,
          roomId: room.id,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
          adults: input.adults,
          children: input.children,
          status: ReservationStatus.CONFIRMED,
          rateAmount: room.roomType.baseRate,
          deposit: input.deposit,
          notes: input.notes,
          createdById: userId,
        },
        select: { id: true },
      });

      return { ok: true as const, reservationId: reservation.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createReservation(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CreateReservationSchema.safeParse(input);

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
          error: `Room ${await selectedRoomLabel(
            parsed.data.roomId,
          )} is no longer available for those dates.`,
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
