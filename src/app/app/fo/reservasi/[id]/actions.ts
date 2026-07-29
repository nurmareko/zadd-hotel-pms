"use server";

import {
  ArrangementType,
  PaymentPurpose,
  Prisma,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
  RoomStatus,
} from "@prisma/client";
import { differenceInCalendarDays, formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { MEAL_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import {
  dateOnlyBoundary,
  hotelTodayDateOnly,
  todayDateOnly,
} from "@/lib/date-only";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { formatDateID } from "@/lib/format";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { createReservationNightMealSnapshot } from "@/lib/reservation-night-schedule";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";
import {
  createPendingReservationStayFees,
  postPendingReservationStayFees,
  reactivatePendingReservationStayFee,
  ReservationStayFeeError,
} from "@/lib/reservation-stay-fees";

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

const MealPlanChangeSchema = z.object({
  reservationId: z.number().int().positive(),
  arrangementType: z.nativeEnum(ArrangementType),
});

type MealPlanChangeResult =
  | { ok: true; effectiveDate: string; changedNights: number }
  | { ok: false; error: string };

const StayFeeSelectionSchema = z.object({
  reservationId: z.number().int().positive(),
  kind: z.nativeEnum(ReservationStayFeeKind),
  selected: z.boolean(),
});

export type StayFeeSelectionResult =
  | { ok: true; status: ReservationStayFeeStatus }
  | { ok: false; error: string };

export async function changeReservationMealPlan(
  input: unknown,
): Promise<MealPlanChangeResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = MealPlanChangeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Perubahan meal plan tidak valid." };
  }

  const { reservationId, arrangementType } = parsed.data;
  const boundary = hotelTodayDateOnly();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "reservation" WHERE id = ${reservationId} FOR UPDATE
        `;
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "reservation_night"
          WHERE reservation_id = ${reservationId} AND date >= ${boundary}
          ORDER BY date ASC
          FOR UPDATE
        `;

        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            status: true,
            adults: true,
            children: true,
            reservationNights: {
              where: { date: { gte: boundary } },
              orderBy: { date: "asc" },
              select: {
                id: true,
                date: true,
                folioLineItems: {
                  where: {
                    article: { code: { in: [...MEAL_ARTICLE_CODES] } },
                  },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        });

        if (!reservation) {
          return { ok: false as const, error: "Reservasi tidak ditemukan." };
        }

        if (
          reservation.status === ReservationStatus.CHECKED_OUT ||
          reservation.status === ReservationStatus.CANCELLED ||
          reservation.status === ReservationStatus.NO_SHOW
        ) {
          return {
            ok: false as const,
            error:
              "Riwayat Inklusi reservasi terminal bersifat final dan tidak dapat diubah.",
          };
        }

        const eligibleNights = reservation.reservationNights.filter(
          (night) => night.folioLineItems.length === 0,
        );
        const firstEligibleNight = eligibleNights[0];

        if (!firstEligibleNight) {
          return {
            ok: false as const,
            error: "Tidak ada malam mendatang yang belum diposting untuk diubah.",
          };
        }

        const eligibleNightIds = eligibleNights.map((night) => night.id);
        const updatedNights = await tx.reservationNight.updateMany({
          where: {
            id: { in: eligibleNightIds },
            reservationId,
            date: { gte: boundary },
            folioLineItems: {
              none: { article: { code: { in: [...MEAL_ARTICLE_CODES] } } },
            },
          },
          data: createReservationNightMealSnapshot(
            arrangementType,
            reservation.adults + reservation.children,
          ),
        });

        if (updatedNights.count !== eligibleNightIds.length) {
          throw new Error("MEAL_PLAN_CHANGE_CONFLICT");
        }

        await tx.reservation.update({
          where: { id: reservationId },
          data: { arrangementType },
        });

        return {
          ok: true as const,
          effectiveDate: formatISO(firstEligibleNight.date, {
            representation: "date",
          }),
          changedNights: updatedNights.count,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePath(`/app/fo/reservasi/${reservationId}`);
    }

    return result;
  } catch (error) {
    if (
      isSerializationConflict(error) ||
      (error instanceof Error && error.message === "MEAL_PLAN_CHANGE_CONFLICT")
    ) {
      return {
        ok: false,
        error: "Jadwal Inklusi berubah saat disimpan. Muat ulang lalu coba lagi.",
      };
    }

    return { ok: false, error: "Gagal mengubah meal plan." };
  }
}

export async function setReservationStayFee(
  input: unknown,
): Promise<StayFeeSelectionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const parsed = StayFeeSelectionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Pilihan fleksibilitas menginap tidak valid." };
  }

  const { reservationId, kind, selected } = parsed.data;
  const userId = Number(session.user.id);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM "folio" WHERE reservation_id = ${reservationId} FOR UPDATE
          `;
          await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM "reservation" WHERE id = ${reservationId} FOR UPDATE
          `;

          const reservation = await tx.reservation.findUnique({
            where: { id: reservationId },
            select: {
              id: true,
              status: true,
              folio: { select: { id: true, status: true } },
              stayFees: {
                where: { kind },
                take: 1,
              },
            },
          });

          if (!reservation) {
            return { ok: false as const, error: "Reservasi tidak ditemukan." };
          }

          if (
            reservation.status === ReservationStatus.CHECKED_OUT ||
            reservation.status === ReservationStatus.CANCELLED ||
            reservation.status === ReservationStatus.NO_SHOW
          ) {
            return {
              ok: false as const,
              error:
                "Riwayat fleksibilitas reservasi terminal bersifat final dan tidak dapat diubah.",
            };
          }

          const existingFee = reservation.stayFees[0] ?? null;

          if (!selected) {
            if (!existingFee || existingFee.status === ReservationStayFeeStatus.CANCELLED) {
              return {
                ok: true as const,
                status: ReservationStayFeeStatus.CANCELLED,
              };
            }

            if (existingFee.status === ReservationStayFeeStatus.POSTED) {
              return {
                ok: false as const,
                error:
                  "Biaya yang sudah terposting bersifat terkunci dan tidak dapat dihapus.",
              };
            }

            const cancelled = await tx.reservationStayFee.updateMany({
              where: {
                id: existingFee.id,
                reservationId,
                kind,
                status: ReservationStayFeeStatus.PENDING,
                folioLineItemId: null,
              },
              data: { status: ReservationStayFeeStatus.CANCELLED },
            });

            if (cancelled.count !== 1) {
              throw new ReservationStayFeeError(
                "Status biaya berubah saat dihapus. Muat ulang lalu coba lagi.",
              );
            }

            return {
              ok: true as const,
              status: ReservationStayFeeStatus.CANCELLED,
            };
          }

          if (existingFee?.status === ReservationStayFeeStatus.POSTED) {
            return {
              ok: false as const,
              error: "Biaya ini sudah terposting dan terkunci.",
            };
          }

          if (existingFee?.status === ReservationStayFeeStatus.CANCELLED) {
            await reactivatePendingReservationStayFee(tx, {
              feeId: existingFee.id,
              kind,
              selectedById: userId,
              selectedAt: new Date(),
            });
          } else if (!existingFee) {
            await createPendingReservationStayFees(tx, {
              reservationId,
              kinds: [kind],
              selectedById: userId,
            });
          }

          if (reservation.status === ReservationStatus.CHECKED_IN) {
            if (!reservation.folio) {
              throw new ReservationStayFeeError(
                "Folio reservasi tidak ditemukan. Biaya tidak diposting.",
              );
            }

            const postedCount = await postPendingReservationStayFees(tx, {
              reservationId,
              folioId: reservation.folio.id,
              postedById: userId,
              postedAt: new Date(),
              kinds: [kind],
            });

            if (postedCount !== 1) {
              throw new ReservationStayFeeError(
                "Biaya tidak berhasil diposting tepat satu kali.",
              );
            }

            return {
              ok: true as const,
              status: ReservationStayFeeStatus.POSTED,
            };
          }

          if (reservation.status !== ReservationStatus.CONFIRMED) {
            return {
              ok: false as const,
              error: "Status reservasi tidak dapat menerima biaya fleksibilitas.",
            };
          }

          return {
            ok: true as const,
            status: ReservationStayFeeStatus.PENDING,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );

      if (result.ok) {
        revalidatePath(`/app/fo/reservasi/${reservationId}`);
      }

      return result;
    } catch (error) {
      if (error instanceof ReservationStayFeeError) {
        return { ok: false, error: error.message };
      }

      if (isSerializationConflict(error) && attempt < 3) {
        continue;
      }

      if (isSerializationConflict(error)) {
        return {
          ok: false,
          error: "Konflik perubahan biaya berulang. Muat ulang lalu coba lagi.",
        };
      }

      return { ok: false, error: "Gagal mengubah biaya fleksibilitas." };
    }
  }

  return {
    ok: false,
    error: "Konflik perubahan biaya berulang. Muat ulang lalu coba lagi.",
  };
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
