"use server";

import {
  DepositStatus,
  PaymentPurpose,
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
import {
  CheckInSchema,
  DepositCollectionSchema,
  type CheckInValues,
  type DepositCollectionValues,
} from "./schema";

type ActionFailure = { ok: false; error: string; field?: string };

export type ActionResult = { ok: true } | ActionFailure;

export type CollectDepositResult =
  | {
      ok: true;
      payment: {
        amount: string;
        method: string;
        reference: string | null;
      };
      alreadyCollected: boolean;
    }
  | ActionFailure;

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
}): ActionFailure {
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
) {
  const { reservation, room, arrivalDate, departureDate } = context;
  const now = new Date();

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

      const firstNight = await tx.reservationNight.findFirst({
        where: { reservationId: reservation.id },
        orderBy: { date: "asc" },
        select: { rateAmount: true },
      });

      if (!firstNight) {
        throw new CheckInActionError(
          "Jadwal harga reservasi tidak tersedia untuk menghitung deposit.",
        );
      }

      const depositAmount = firstNight.rateAmount;
      const currentReservation = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: {
          status: true,
          depositStatus: true,
          folio: { select: { id: true } },
        },
      });

      if (
        !currentReservation ||
        currentReservation.status !== ReservationStatus.CONFIRMED
      ) {
        throw new CheckInActionError(
          "Reservasi tidak dalam status yang bisa check-in",
        );
      }

      if (currentReservation.depositStatus === DepositStatus.PENDING) {
        throw new CheckInActionError(
          "Deposit belum dibayar. Kumpulkan deposit sebelum check-in.",
        );
      }

      if (!currentReservation.folio) {
        throw new CheckInActionError(
          "Folio deposit tidak ditemukan. Kumpulkan deposit sebelum check-in.",
        );
      }

      await tx.guest.update({
        where: { id: reservation.guestId },
        data: {
          fullName: input.guestFullName,
          idType: input.guestIdType,
          idNumber: input.guestIdNumber || null,
          phone: input.guestPhone || null,
          email: input.guestEmail || null,
          nationality: input.guestNationality || null,
        },
      });

      const updatedReservation = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.COLLECTED,
        },
        data: {
          status: ReservationStatus.CHECKED_IN,
          roomId: room.id,
          grcFilledAt: now,
          purposeOfVisit: input.grcPurposeOfVisit,
          signatureDataUrl: input.signatureDataUrl,
          signedAt: now,
          deposit: depositAmount,
        },
      });

      if (updatedReservation.count === 0) {
        throw new CheckInActionError(
          "Status reservasi atau deposit berubah sebelum check-in dapat diselesaikan.",
        );
      }

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

      return { ok: true as const, folioId: currentReservation.folio.id };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function runDepositCollectionTransaction(
  input: DepositCollectionValues,
  userId: number,
  expectedGroupBookingId?: string,
) {
  const now = new Date();
  const folioNo = await nextFolioNumber(now);

  return prisma.$transaction(
    async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          status: true,
          depositStatus: true,
          arrivalDate: true,
          groupBookingId: true,
          folio: {
            select: {
              id: true,
              payments: {
                where: { purpose: PaymentPurpose.DEPOSIT },
                select: { amount: true, method: true, reference: true },
                take: 1,
              },
            },
          },
          reservationNights: {
            orderBy: { date: "asc" },
            select: { rateAmount: true },
            take: 1,
          },
        },
      });

      if (!reservation || reservation.status !== ReservationStatus.CONFIRMED) {
        throw new CheckInActionError(
          "Reservasi tidak dalam status yang bisa mengumpulkan deposit",
        );
      }

      if (
        expectedGroupBookingId !== undefined &&
        reservation.groupBookingId !== expectedGroupBookingId
      ) {
        throw new CheckInActionError(
          "Reservasi tidak lagi termasuk dalam booking grup ini.",
        );
      }

      const { today } = todayDateOnly();
      if (dateOnlyBoundary(reservation.arrivalDate) > today) {
        throw new CheckInActionError(
          "Deposit check-in baru dapat dikumpulkan pada hari kedatangan",
        );
      }

      const existingPayment = reservation.folio?.payments[0];
      if (reservation.depositStatus === DepositStatus.COLLECTED) {
        if (!existingPayment) {
          throw new CheckInActionError(
            "Status deposit tidak sesuai dengan pembayaran pada folio.",
          );
        }

        return {
          payment: {
            amount: existingPayment.amount,
            method: existingPayment.method,
            reference: existingPayment.reference,
          },
          alreadyCollected: true,
        };
      }

      const firstNight = reservation.reservationNights[0];
      if (!firstNight) {
        throw new CheckInActionError(
          "Jadwal harga reservasi tidak tersedia untuk menghitung deposit.",
        );
      }

      if (!firstNight.rateAmount.isPositive()) {
        throw new CheckInActionError(
          "Tarif malam pertama harus lebih besar dari 0 sebelum deposit dapat dikumpulkan.",
        );
      }

      if (existingPayment) {
        throw new CheckInActionError(
          "Pembayaran deposit sudah ada tetapi status deposit belum diperbarui.",
        );
      }

      const folio = reservation.folio
        ? { id: reservation.folio.id }
        : await tx.folio.create({
            data: {
              folioNo,
              reservationId: input.reservationId,
              status: "OPEN",
              openedAt: now,
            },
            select: { id: true },
          });
      const payment = await tx.payment.create({
        data: {
          folioId: folio.id,
          amount: firstNight.rateAmount,
          method: input.depositMethod,
          purpose: PaymentPurpose.DEPOSIT,
          reference: input.depositReference,
          receivedById: userId,
          receivedAt: now,
        },
        select: { amount: true, method: true, reference: true },
      });
      const collectedReservation = await tx.reservation.updateMany({
        where: {
          id: input.reservationId,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
        },
        data: {
          deposit: firstNight.rateAmount,
          depositStatus: DepositStatus.COLLECTED,
        },
      });

      if (collectedReservation.count === 0) {
        throw new CheckInActionError(
          "Status deposit berubah sebelum pembayaran dapat dicatat.",
        );
      }

      return { payment, alreadyCollected: false };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function collectValidatedDeposit(
  input: DepositCollectionValues,
  userId: number,
  expectedGroupBookingId?: string,
): Promise<CollectDepositResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await runDepositCollectionTransaction(
        input,
        userId,
        expectedGroupBookingId,
      );

      return {
        ok: true,
        payment: {
          amount: result.payment.amount.toString(),
          method: result.payment.method,
          reference: result.payment.reference,
        },
        alreadyCollected: result.alreadyCollected,
      };
    } catch (error) {
      if (error instanceof CheckInActionError) {
        return { ok: false, error: error.message };
      }

      if (attempt < 2 && isRetryableFolioNumberError(error)) {
        continue;
      }

      if (isSerializationConflict(error)) {
        return {
          ok: false,
          error: "Status deposit berubah bersamaan. Muat ulang lalu coba lagi.",
        };
      }

      return { ok: false, error: "Gagal mencatat pembayaran deposit" };
    }
  }

  return { ok: false, error: "Gagal mencatat pembayaran deposit" };
}

export async function collectCheckInDepositForGroup(input: {
  reservationId: number;
  depositMethod: string;
  depositReference?: string;
  groupBookingId: string;
}): Promise<CollectDepositResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = DepositCollectionSchema.safeParse(input);
  const groupBookingId = input.groupBookingId.trim();
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  if (!groupBookingId) {
    return { ok: false, error: "Booking grup tidak valid" };
  }

  return collectValidatedDeposit(
    parsed.data,
    Number(session.user.id),
    groupBookingId,
  );
}

export async function collectCheckInDeposit(
  formData: FormData,
): Promise<CollectDepositResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = DepositCollectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const result = await collectValidatedDeposit(parsed.data, Number(session.user.id));
  if (!result.ok) {
    return result;
  }

  revalidatePath(`/app/fo/reservasi/${parsed.data.reservationId}`);

  return result;
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
      result = await runCheckInTransaction(parsed.data, prepared.context);
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
    redirect("/app/fo/reservasi");
  }

  return { ok: true };
}
