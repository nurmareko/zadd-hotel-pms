"use server";

import {
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
// Prisma @db.Date filters require dateOnlyBoundary (UTC midnight).
// Timestamp filters (createdAt, receivedAt, etc.) use startOfDay (local midnight).
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { CheckInSchema, type CheckInValues } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

type CompleteCheckInOptions = {
  /**
   * The individual check-in page should continue to land on its new folio.
   * Batch orchestration keeps the operator on its group summary instead.
   */
  redirectToFolio?: boolean;
};

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

type CheckInContext = {
  reservation: {
    id: number;
    roomTypeId: number;
    guestId: number;
    arrivalDate: Date;
    departureDate: Date;
    status: ReservationStatus;
  };
  room: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  };
  arrivalDate: Date;
  departureDate: Date;
};

class CheckInActionError extends Error {}

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data check-in tidak valid",
    field,
  };
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

  return `Kamar ${room?.number ?? roomId} sudah tidak tersedia. Pilih kamar lain.`;
}

async function prepareCheckInContext(input: CheckInValues) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      roomTypeId: true,
      guestId: true,
      arrivalDate: true,
      departureDate: true,
      status: true,
    },
  });

  if (!reservation || reservation.status !== ReservationStatus.CONFIRMED) {
    return {
      ok: false as const,
      error: "Reservasi tidak dalam status yang bisa check-in",
    };
  }

  const arrivalDate = dateOnlyBoundary(reservation.arrivalDate);
  const departureDate = dateOnlyBoundary(reservation.departureDate);
  const { today } = todayDateOnly();

  if (arrivalDate > today) {
    return {
      ok: false as const,
      error: "Tanggal kedatangan belum bisa check-in",
    };
  }

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: { id: true, number: true, roomTypeId: true, status: true },
  });

  if (!room || room.roomTypeId !== reservation.roomTypeId) {
    return {
      ok: false as const,
      error: "Kamar tidak valid untuk reservasi ini",
      field: "roomId",
    };
  }

  if (room.status === RoomStatus.OOO) {
    return {
      ok: false as const,
      error: `Kamar ${room.number} sedang out of order. Pilih kamar lain.`,
      field: "roomId",
    };
  }

  const overlappingReservation = await prisma.reservation.findFirst({
    where: {
      id: { not: reservation.id },
      roomId: room.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      arrivalDate: { lt: departureDate },
      departureDate: { gt: arrivalDate },
    },
    select: { id: true },
  });

  if (overlappingReservation) {
    return {
      ok: false as const,
      error: `Kamar ${room.number} sudah tidak tersedia. Pilih kamar lain.`,
      field: "roomId",
    };
  }

  return {
    ok: true as const,
    context: { reservation, room, arrivalDate, departureDate },
  };
}

async function nextFolioNumber(now: Date) {
  const folioPrefix = `FOL-${format(now, "ddMM")}-`;
  const folioCount = await prisma.folio.count({
    where: { folioNo: { startsWith: folioPrefix } },
  });

  return `${folioPrefix}${String(folioCount + 1).padStart(4, "0")}`;
}

async function runCheckInTransaction(
  input: CheckInValues,
  context: CheckInContext,
  userId: number,
) {
  const { reservation, room, arrivalDate, departureDate } = context;
  const now = new Date();
  const folioNo = await nextFolioNumber(now);

  return prisma.$transaction(
    async (tx) => {
      const overlappingReservation = await tx.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: room.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          arrivalDate: { lt: departureDate },
          departureDate: { gt: arrivalDate },
        },
        select: { id: true },
      });

      if (overlappingReservation) {
        throw new CheckInActionError(
          `Kamar ${room.number} sudah tidak tersedia. Pilih kamar lain.`,
        );
      }

      await tx.guest.update({
        where: { id: reservation.guestId },
        data: {
          fullName: input.guestFullName,
          idNumber: input.guestIdNumber || null,
          phone: input.guestPhone || null,
          email: input.guestEmail || null,
          nationality: input.guestNationality || null,
        },
      });

      const updatedReservation = await tx.reservation.updateMany({
        where: { id: reservation.id, status: ReservationStatus.CONFIRMED },
        data: {
          status: ReservationStatus.CHECKED_IN,
          roomId: room.id,
          grcFilledAt: now,
          purposeOfVisit: input.grcPurposeOfVisit,
          signatureDataUrl: input.signatureDataUrl,
          signedAt: now,
          deposit: input.depositAmount,
        },
      });

      if (updatedReservation.count === 0) {
        throw new CheckInActionError("Reservation is not in confirmable state");
      }

      const folio = await tx.folio.create({
        data: {
          folioNo,
          reservationId: reservation.id,
          status: "OPEN",
          openedAt: now,
        },
        select: { id: true },
      });

      const updatedRoom = await tx.room.updateMany({
        where: {
          id: room.id,
          roomTypeId: reservation.roomTypeId,
          status: { not: RoomStatus.OOO },
        },
        data: { status: RoomStatus.OC },
      });

      if (updatedRoom.count === 0) {
        throw new CheckInActionError(
          `Kamar ${room.number} sedang out of order. Pilih kamar lain.`,
        );
      }

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
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function completeCheckIn(
  formData: FormData,
  options: CompleteCheckInOptions = {},
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CheckInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const userId = Number(session.user.id);
  const prepared = await prepareCheckInContext(parsed.data);

  if (!prepared.ok) {
    return prepared;
  }

  let result: Awaited<ReturnType<typeof runCheckInTransaction>> | null = null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCheckInTransaction(
        parsed.data,
        prepared.context,
        userId,
      );
      break;
    } catch (error) {
      if (error instanceof CheckInActionError) {
        return { ok: false, error: error.message };
      }

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

  await logActivity({
    userId,
    action: "CHECK_IN_COMPLETED",
    reservationId: parsed.data.reservationId,
    folioId: result.folioId,
    roomId: parsed.data.roomId,
  });

  revalidatePath("/app/fo/reservasi/kalender");
  revalidatePath("/app/fo/reservasi/list");
  revalidatePath(`/app/fo/reservasi/${parsed.data.reservationId}`);

  if (options.redirectToFolio !== false) {
    redirect(`/app/fo/folios/${result.folioId}`);
  }

  return { ok: true };
}
