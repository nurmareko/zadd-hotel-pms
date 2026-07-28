"use server";

import {
  PaymentPurpose,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { auth } from "@/auth";
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { formatDateID } from "@/lib/format";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function getFreshCheckInReview(reservationId: number) {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false as const, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false as const, error: "Reservasi tidak valid" };
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      reservationNo: true,
      reservationType: true,
      arrangementType: true,
      roomTypeId: true,
      arrivalDate: true,
      departureDate: true,
      adults: true,
      children: true,
      status: true,
      depositStatus: true,
      rateAmount: true,
      updatedAt: true,
      guest: {
        select: {
          fullName: true,
          idType: true,
          idNumber: true,
          phone: true,
          email: true,
          nationality: true,
        },
      },
      room: {
        select: {
          id: true,
          number: true,
          status: true,
          roomTypeId: true,
        },
      },
      roomType: { select: { name: true } },
      folio: {
        select: {
          payments: {
            where: { purpose: PaymentPurpose.DEPOSIT },
            select: { amount: true, method: true, reference: true },
            orderBy: { receivedAt: "asc" },
            take: 1,
          },
        },
      },
      reservationNights: {
        select: { date: true, rateAmount: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!reservation) {
    return { ok: false as const, error: "Reservasi tidak ditemukan" };
  }

  const roomOverlap = reservation.room
    ? await prisma.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: reservation.room.id,
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          arrivalDate: { lt: reservation.departureDate },
          departureDate: { gt: reservation.arrivalDate },
        },
        select: { id: true },
      })
    : null;
  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });
  const depositPayment = reservation.folio?.payments[0] ?? null;
  const firstNight = reservation.reservationNights[0] ?? null;
  const { today } = todayDateOnly();
  const roomReady = Boolean(
    reservation.room &&
      reservation.room.roomTypeId === reservation.roomTypeId &&
      reservation.room.status !== RoomStatus.OOO &&
      !roomOverlap,
  );

  return {
    ok: true as const,
    review: {
      snapshotVersion: reservation.updatedAt.toISOString(),
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      reservationType: reservation.reservationType,
      arrangementType: reservation.arrangementType,
      status: reservation.status,
      arrivalDue: dateOnlyBoundary(reservation.arrivalDate) <= today,
      guest: reservation.guest,
      stay: {
        arrivalLabel: formatDateID(reservation.arrivalDate),
        departureLabel: formatDateID(reservation.departureDate),
        nights: differenceInCalendarDays(
          reservation.departureDate,
          reservation.arrivalDate,
        ),
        adults: reservation.adults,
        children: reservation.children,
        total: stayTotal.total.toString(),
        nightlySchedule: stayTotal.nightlySchedule.map((night) => ({
          dateLabel: formatDateID(night.date),
          rateAmount: night.rateAmount.toString(),
        })),
      },
      room: reservation.room
        ? {
            id: reservation.room.id,
            number: reservation.room.number,
            status: reservation.room.status,
            typeName: reservation.roomType.name,
          }
        : null,
      roomReady,
      deposit: {
        status: reservation.depositStatus,
        requiredAmount: firstNight?.rateAmount.toString() ?? null,
        payment: depositPayment
          ? {
              amount: depositPayment.amount.toString(),
              method: depositPayment.method,
              reference: depositPayment.reference,
            }
          : null,
      },
    },
  };
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function requestRoomCleaning(
  reservationId: number,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Reservasi tidak valid" };
  }

  const userId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "reservation" WHERE id = ${reservationId} FOR UPDATE
        `;

        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: { id: true, roomId: true, status: true },
        });

        if (!reservation) {
          return { ok: false as const, error: "Reservasi tidak ditemukan" };
        }

        if (reservation.status !== ReservationStatus.CHECKED_IN) {
          return {
            ok: false as const,
            error:
              "Pembersihan kamar hanya bisa diminta untuk tamu yang sedang check-in.",
          };
        }

        if (!reservation.roomId) {
          return {
            ok: false as const,
            error: "Reservasi check-in belum memiliki kamar.",
          };
        }

        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "room" WHERE id = ${reservation.roomId} FOR UPDATE
        `;

        const room = await tx.room.findUnique({
          where: { id: reservation.roomId },
          select: { id: true, number: true, status: true },
        });

        if (!room) {
          return { ok: false as const, error: "Kamar tidak ditemukan" };
        }

        if (room.status === RoomStatus.OD) {
          return { ok: true as const, roomId: room.id };
        }

        if (room.status !== RoomStatus.OC) {
          return {
            ok: false as const,
            error: `Kamar ${room.number} tidak berstatus OC. Muat ulang halaman dan periksa status kamar.`,
          };
        }

        const now = new Date();

        await tx.housekeepingLog.create({
          data: {
            roomId: room.id,
            oldStatus: RoomStatus.OC,
            newStatus: RoomStatus.OD,
            updatedById: userId,
            updatedAt: now,
            note: "Permintaan pembersihan kamar dari Front Office",
          },
        });

        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.OD },
        });

        return { ok: true as const, roomId: room.id };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateRoomStatusViews({ reservationId, roomId: result.roomId });
    }

    return result;
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: "Status kamar berubah saat diproses. Muat ulang halaman.",
      };
    }

    return { ok: false, error: "Gagal meminta pembersihan kamar" };
  }
}
