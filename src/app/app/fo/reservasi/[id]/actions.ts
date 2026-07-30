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
import { differenceInCalendarDays } from "date-fns";
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

import {
  buildReservationMealPlanChange,
  matchesExpectedMealPlanPreview,
} from "@/lib/reservation-meal-plan-change";
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

function revalidateCommittedInclusion(
  reservationId: number,
  groupBookingId?: string,
) {
  try {
    revalidatePath(`/app/fo/reservasi/${reservationId}`);
    if (groupBookingId) {
      revalidatePath(`/app/fo/reservasi/grup/${groupBookingId}`);
    }
  } catch (error) {
    console.error("Gagal menyegarkan tampilan Inklusi setelah transaksi", error);
  }
}

const ExpectedGroupBookingSchema = z.string().trim().min(1).max(32).optional();

const ExpectedMealPlanPreviewSchema = z.object({
  reservationId: z.number().int().positive(),
  groupBookingId: z.string().nullable(),
  reservationStatus: z.nativeEnum(ReservationStatus),
  currentPlan: z.nativeEnum(ArrangementType),
  pax: z.number().int(),
  nightsAffected: z.number().int().nonnegative(),
  unitPrice: z.string(),
  nightlyAmount: z.string(),
  expectedAmount: z.string(),
  effectiveDate: z.string(),
});

const ExpectedIneligibleMealPlanPreviewSchema = z.object({
  reservationId: z.number().int().positive(),
  groupBookingId: z.string().nullable(),
  reservationStatus: z.nativeEnum(ReservationStatus).nullable(),
  currentPlan: z.nativeEnum(ArrangementType).nullable(),
  pax: z.number().int().nullable(),
  reason: z.string().min(1),
});

const MealPlanChangeSchema = z
  .object({
    reservationId: z.number().int().positive(),
    arrangementType: z.nativeEnum(ArrangementType),
    expectedGroupBookingId: ExpectedGroupBookingSchema,
    expectedPreview: ExpectedMealPlanPreviewSchema.optional(),
    expectedIneligiblePreview: ExpectedIneligibleMealPlanPreviewSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.expectedGroupBookingId) return;

    const bindingCount =
      Number(Boolean(value.expectedPreview)) +
      Number(Boolean(value.expectedIneligiblePreview));
    if (bindingCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedPreview"],
        message: "Pratinjau grup wajib terikat tepat satu kali.",
      });
    }
  });

export type MealPlanChangeResult =
  | { ok: true; effectiveDate: string; changedNights: number }
  | { ok: false; error: string; disposition?: "skipped" | "failed" };

const StayFeeSelectionSchema = z.object({
  reservationId: z.number().int().positive(),
  kind: z.nativeEnum(ReservationStayFeeKind),
  selected: z.boolean(),
  expectedGroupBookingId: ExpectedGroupBookingSchema,
});

export type StayFeeSelectionResult =
  | { ok: true; status: ReservationStayFeeStatus; changed: boolean }
  | { ok: false; error: string; disposition?: "skipped" | "failed" };

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

  const {
    reservationId,
    arrangementType,
    expectedGroupBookingId,
    expectedPreview,
    expectedIneligiblePreview,
  } = parsed.data;
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
            groupBookingId: true,
            arrangementType: true,
            adults: true,
            children: true,
            roomType: { select: { capacity: true } },
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
          return {
            ok: false as const,
            error: "Reservasi tidak ditemukan.",
            disposition: "failed" as const,
          };
        }

        const change = buildReservationMealPlanChange({
          reservationId: reservation.id,
          groupBookingId: reservation.groupBookingId,
          expectedGroupBookingId,
          status: reservation.status,
          currentPlan: reservation.arrangementType,
          targetPlan: arrangementType,
          adults: reservation.adults,
          children: reservation.children,
          roomCapacity: reservation.roomType.capacity,
          nights: reservation.reservationNights.map((night) => ({
            id: night.id,
            date: night.date,
            posted: night.folioLineItems.length > 0,
          })),
        });

        if (expectedIneligiblePreview) {
          const currentPax = reservation.adults + reservation.children;
          if (
            change.ok ||
            reservation.id !== expectedIneligiblePreview.reservationId ||
            reservation.groupBookingId !==
              expectedIneligiblePreview.groupBookingId ||
            reservation.status !== expectedIneligiblePreview.reservationStatus ||
            reservation.arrangementType !==
              expectedIneligiblePreview.currentPlan ||
            currentPax !== expectedIneligiblePreview.pax ||
            change.error !== expectedIneligiblePreview.reason
          ) {
            return {
              ok: false as const,
              error:
                "Data kamar berubah setelah pratinjau. Tampilkan pratinjau baru sebelum menerapkan meal plan.",
              disposition: "failed" as const,
            };
          }

          return {
            ok: false as const,
            error: change.error,
            disposition: change.disposition,
          };
        }

        if (!change.ok) {
          return {
            ok: false as const,
            error: change.error,
            disposition: change.disposition,
          };
        }

        if (
          expectedPreview &&
          !matchesExpectedMealPlanPreview(change.snapshot, expectedPreview)
        ) {
          return {
            ok: false as const,
            error:
              "Data kamar berubah setelah pratinjau. Tampilkan pratinjau baru sebelum menerapkan meal plan.",
            disposition: "failed" as const,
          };
        }

        const eligibleNightIds = change.snapshot.eligibleNightIds;
        const updatedNights = await tx.reservationNight.updateMany({
          where: {
            id: { in: eligibleNightIds },
            reservationId,
            date: { gte: boundary },
            folioLineItems: {
              none: { article: { code: { in: [...MEAL_ARTICLE_CODES] } } },
            },
          },
          data: change.data,
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
          effectiveDate: change.snapshot.effectiveDate,
          changedNights: updatedNights.count,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateCommittedInclusion(reservationId, expectedGroupBookingId);
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

    return {
      ok: false,
      error: "Gagal mengubah meal plan.",
      disposition: "failed",
    };
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

  const { reservationId, kind, selected, expectedGroupBookingId } = parsed.data;
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
              groupBookingId: true,
              folio: { select: { id: true, status: true } },
              stayFees: {
                where: { kind },
                take: 1,
              },
            },
          });

          if (!reservation) {
            return {
              ok: false as const,
              error: "Reservasi tidak ditemukan.",
              disposition: "failed" as const,
            };
          }

          if (
            expectedGroupBookingId &&
            reservation.groupBookingId !== expectedGroupBookingId
          ) {
            return {
              ok: false as const,
              error: "Reservasi bukan anggota booking grup ini.",
              disposition: "failed" as const,
            };
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
              disposition: "skipped" as const,
            };
          }

          const existingFee = reservation.stayFees[0] ?? null;

          if (!selected) {
            if (!existingFee || existingFee.status === ReservationStayFeeStatus.CANCELLED) {
              return {
                ok: true as const,
                status: ReservationStayFeeStatus.CANCELLED,
                changed: false,
              };
            }

            if (existingFee.status === ReservationStayFeeStatus.POSTED) {
              return {
                ok: false as const,
                error:
                  "Biaya yang sudah terposting bersifat terkunci dan tidak dapat dihapus.",
                disposition: "skipped" as const,
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
              changed: true,
            };
          }

          if (existingFee?.status === ReservationStayFeeStatus.POSTED) {
            return {
              ok: false as const,
              error: "Biaya ini sudah terposting dan terkunci.",
              disposition: "skipped" as const,
            };
          }

          if (
            existingFee?.status === ReservationStayFeeStatus.PENDING &&
            reservation.status === ReservationStatus.CONFIRMED
          ) {
            return {
              ok: true as const,
              status: ReservationStayFeeStatus.PENDING,
              changed: false,
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
              changed: true,
            };
          }

          if (reservation.status !== ReservationStatus.CONFIRMED) {
            return {
              ok: false as const,
              error: "Status reservasi tidak dapat menerima biaya fleksibilitas.",
              disposition: "skipped" as const,
            };
          }

          return {
            ok: true as const,
            status: ReservationStayFeeStatus.PENDING,
            changed: true,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...TRANSACTION_OPTIONS,
        },
      );

      if (result.ok) {
        revalidateCommittedInclusion(reservationId, expectedGroupBookingId);
      }

      return result;
    } catch (error) {
      if (error instanceof ReservationStayFeeError) {
        return { ok: false, error: error.message, disposition: "failed" };
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

      return {
        ok: false,
        error: "Gagal mengubah biaya fleksibilitas.",
        disposition: "failed",
      };
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
