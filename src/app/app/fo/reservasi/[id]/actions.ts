"use server";

import {
  Prisma,
  ReservationStatus,
  ReservationNightRevenueClass,
  RoomStatus,
} from "@prisma/client";

import { parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { getActiveRoomBlocks } from "@/lib/room-blocks/queries";
import { validateRoomTypeCapacity } from "@/lib/reservation-capacity";
import { PricingResolutionError, resolveNightlySchedule } from "@/lib/pricing-resolver";
import { getMealPlanPrices } from "@/lib/arrangement-inclusions";
import { createReservationNightMealSnapshot } from "@/lib/reservation-night-schedule";
import {
  getCheckInReviewData,
  getFreshCheckInReview,
} from "@/lib/check-in/actions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { revalidateRoomStatusViews } from "@/lib/revalidate-room-status";
import {
  changeReservationMealPlan,
  setReservationStayFee,
} from "@/lib/reservation-inclusions/actions";

export { getCheckInReviewData, getFreshCheckInReview };
export { changeReservationMealPlan, setReservationStayFee };
export type {
  MealPlanChangeResult,
  StayFeeSelectionResult,
} from "@/lib/reservation-inclusions/actions";

type ActionResult = { ok: true } | { ok: false; error: string };

type ExtendStayResult =
  | { ok: true; data: { newDepartureDate: string; additionalNights: number } }
  | { ok: false; error: string };

const ExtendReservationStaySchema = z.object({
  reservationId: z.coerce.number().int().positive(),
  newDepartureDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .refine(isValidISODateOnly, "Tanggal keberangkatan tidak valid."),
});

export async function extendReservationStay(input: unknown): Promise<ExtendStayResult> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "reservations:write")) {
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }
  const parsed = ExtendReservationStaySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.path[0] === "newDepartureDate"
      ? parsed.error.issues[0].message : "Reservasi tidak valid." };
  }
  const { reservationId, newDepartureDate } = parsed.data;
  const newDeparture = parseISODateOnly(newDepartureDate);
  let result: ExtendStayResult;
  for (let attempt = 0; ; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx): Promise<ExtendStayResult> => {
        await tx.$queryRaw`SELECT id FROM "reservation" WHERE id = ${reservationId} FOR UPDATE`;
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true, status: true, roomId: true, roomTypeId: true,
            arrivalDate: true, departureDate: true, adults: true, children: true,
            arrangementType: true, room: { select: { id: true, number: true } },
          },
        });
        if (!reservation) return { ok: false, error: "Reservasi tidak ditemukan." };
        if (reservation.status !== ReservationStatus.CHECKED_IN) {
          return { ok: false, error: "Hanya reservasi yang sedang check-in yang dapat diperpanjang masa menginapnya." };
        }
        if (reservation.roomId === null) return { ok: false, error: "Reservasi check-in belum memiliki kamar." };
        if (newDeparture <= reservation.departureDate) {
          return { ok: false, error: "Tanggal keberangkatan baru harus setelah tanggal keberangkatan saat ini." };
        }
        await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${reservation.roomId} FOR UPDATE`;
        const oldDepartureDate = reservation.departureDate.toISOString().slice(0, 10);
        const [block] = await getActiveRoomBlocks({
          roomId: reservation.roomId,
          range: { startDate: oldDepartureDate, endDate: newDepartureDate },
        }, tx);
        if (block) return { ok: false, error: `Kamar ${reservation.room?.number} terblokir pada tanggal tersebut.` };
        const overlap = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id }, roomId: reservation.roomId,
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
            arrivalDate: { lt: newDeparture }, departureDate: { gt: reservation.departureDate },
          },
        });
        if (overlap) return { ok: false, error: `Kamar ${reservation.room?.number} sudah dipesan untuk tanggal tersebut.` };
        const capacity = await validateRoomTypeCapacity({
          roomTypeId: reservation.roomTypeId,
          // This helper accepts local calendar dates and normalizes them itself.
          arrival: parseISO(oldDepartureDate), departure: parseISO(newDepartureDate),
          excludeReservationId: reservation.id,
        }, tx);
        if (!capacity.ok) return { ok: false, error: capacity.error };
        const additionalSchedule = await resolveNightlySchedule({
          roomTypeId: reservation.roomTypeId,
          arrivalDate: oldDepartureDate, departureDate: newDepartureDate,
        }, tx);
        const mealPlanPrices = await getMealPlanPrices(tx);
        const mealSnapshot = createReservationNightMealSnapshot(
          reservation.arrangementType, reservation.adults + reservation.children,
          new Prisma.Decimal(mealPlanPrices[reservation.arrangementType] ?? 0),
        );
        // Historical nights retain their IDs, prices, and posted-charge links.
        await tx.reservationNight.createMany({
          data: additionalSchedule.map((night) => ({
            reservationId: reservation.id, date: night.date, rateAmount: night.rate,
            revenueClass: ReservationNightRevenueClass.PAID,
            sourcePricingRuleId: night.sourceRule?.id ?? null,
            ...mealSnapshot,
          })),
        });
        await tx.reservation.update({
          where: { id: reservation.id }, data: { departureDate: newDeparture },
        });
        // The existing enum has no extension action; keep the event atomic without a migration.
        await tx.activityLog.create({ data: {
          userId: Number(session.user.id), action: "RESERVATION_UPDATED",
          reservationId: reservation.id, roomId: reservation.roomId,
          metadata: { event: "RESERVATION_EXTENDED", oldDepartureDate,
            newDepartureDate, additionalNights: additionalSchedule.length },
        } });
        return { ok: true, data: { newDepartureDate, additionalNights: additionalSchedule.length } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, ...TRANSACTION_OPTIONS });
      break;
    } catch (error) {
      if (isSerializationConflict(error)) {
        if (attempt < 2) continue;
        return { ok: false, error: "Reservasi atau ketersediaan kamar berubah saat diproses. Muat ulang halaman dan coba lagi." };
      }
      if (error instanceof PricingResolutionError) return { ok: false, error: error.message };
      console.error("Failed to extend reservation stay", error);
      return { ok: false, error: "Gagal memperpanjang masa menginap." };
    }
  }
  if (result.ok) {
    revalidatePath("/app/fo");
    revalidatePath(`/app/fo/reservasi/${reservationId}`);
    revalidatePath("/app/fo/reservasi/list");
    revalidatePath("/app/fo/reservasi/kalender");
  }
  return result;
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

  if (
    session?.user.role !== "FO" &&
    session?.user.role !== "ADMIN" &&
    session?.user.role !== "GM"
  ) {
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
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
