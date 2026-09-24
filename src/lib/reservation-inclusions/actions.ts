"use server";

import {
  ArrangementType,
  Prisma,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getMealPlanPrices, MEAL_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { hotelTodayDateOnly } from "@/lib/date-only";
import { NightAuditClosedError } from "@/lib/night-audit";
import { can } from "@/lib/permissions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  buildReservationMealPlanChange,
  matchesExpectedMealPlanPreview,
} from "@/lib/reservation-meal-plan-change";
import {
  createPendingReservationStayFees,
  postPendingReservationStayFees,
  reactivatePendingReservationStayFee,
  ReservationStayFeeError,
} from "@/lib/reservation-stay-fees";

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

  if (!session?.user || !can(session.user.role, "reservations:write")) {
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

        const mealPlanPrices = await getMealPlanPrices(tx);
        const change = buildReservationMealPlanChange({
          reservationId: reservation.id,
          groupBookingId: reservation.groupBookingId,
          expectedGroupBookingId,
          status: reservation.status,
          currentPlan: reservation.arrangementType,
          targetPlan: arrangementType,
          unitPriceOverride: new Prisma.Decimal(mealPlanPrices[arrangementType]),
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

  if (!session?.user || !can(session.user.role, "reservations:write")) {
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
      if (error instanceof NightAuditClosedError) {
        return {
          ok: false as const,
          error:
            "Audit malam untuk tanggal bisnis hari ini sudah selesai. Biaya fleksibilitas tidak dapat diposting.",
          disposition: "skipped" as const,
        };
      }

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
