import { Prisma, ReservationStatus } from "@prisma/client";

import { createReservationNightSchedule } from "@/lib/reservation-night-schedule";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

type AnomalyKind =
  | "CONCURRENT_SCHEDULE_CHANGE"
  | "FRACTIONAL_LEGACY_RATE"
  | "INVALID_STAY_RANGE"
  | "NEGATIVE_LEGACY_RATE"
  | "OUT_OF_RANGE_NIGHT"
  | "OVER_POSTED_ROOM_CHARGES"
  | "SCHEDULE_COUNT_MISMATCH"
  | "UNEXPECTED_DUPLICATE_NIGHT"
  | "ZERO_NIGHT_RESERVATION";

type ReconciliationNote = {
  kind: AnomalyKind;
  reservationId: number;
  reservationNo: string;
  detail: string;
};

type ReservationForReconciliation = {
  id: number;
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
  reservationNights: Array<{ date: Date; rateAmount: Prisma.Decimal }>;
  folio: { lineItems: Array<{ id: number }> } | null;
};

const BACKFILL_SCOPE = Object.values(ReservationStatus);

function dateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function isRetryableScheduleConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034" || error.code === "P2028")
  );
}

async function loadReservations(): Promise<ReservationForReconciliation[]> {
  return prisma.reservation.findMany({
    select: {
      id: true,
      reservationNo: true,
      arrivalDate: true,
      departureDate: true,
      rateAmount: true,
      reservationNights: {
        select: { date: true, rateAmount: true },
        orderBy: { date: "asc" },
      },
      folio: {
        select: {
          lineItems: {
            where: { article: { code: ROOM_CHARGE_ARTICLE_CODE } },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });
}

function reconcileReservation(
  reservation: ReservationForReconciliation,
  notes: ReconciliationNote[],
) {
  const expectedSchedule = createReservationNightSchedule({
    reservationId: reservation.id,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
  });
  const expectedDateKeys = new Set(expectedSchedule.map((night) => dateKey(night.date)));
  const actualDateKeys = reservation.reservationNights.map((night) =>
    dateKey(night.date),
  );

  if (expectedSchedule.length === 0) {
    notes.push({
      kind: "INVALID_STAY_RANGE",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `arrival=${dateKey(reservation.arrivalDate)}, departure=${dateKey(reservation.departureDate)}`,
    });
  }

  if (reservation.reservationNights.length === 0) {
    notes.push({
      kind: "ZERO_NIGHT_RESERVATION",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `expected=${expectedSchedule.length}`,
    });
  }

  if (reservation.reservationNights.length !== expectedSchedule.length) {
    notes.push({
      kind: "SCHEDULE_COUNT_MISMATCH",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `expected=${expectedSchedule.length}, actual=${reservation.reservationNights.length}`,
    });
  }

  const duplicateDates = actualDateKeys.filter(
    (date, index) => actualDateKeys.indexOf(date) !== index,
  );
  if (duplicateDates.length > 0) {
    notes.push({
      kind: "UNEXPECTED_DUPLICATE_NIGHT",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: [...new Set(duplicateDates)].join(", "),
    });
  }

  const outOfRangeDates = actualDateKeys.filter(
    (date) => !expectedDateKeys.has(date),
  );
  if (outOfRangeDates.length > 0) {
    notes.push({
      kind: "OUT_OF_RANGE_NIGHT",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: outOfRangeDates.join(", "),
    });
  }

  if (!reservation.rateAmount.isInteger()) {
    notes.push({
      kind: "FRACTIONAL_LEGACY_RATE",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `rateAmount=${reservation.rateAmount.toString()}`,
    });
  }

  if (reservation.rateAmount.isNegative()) {
    notes.push({
      kind: "NEGATIVE_LEGACY_RATE",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `rateAmount=${reservation.rateAmount.toString()} cannot satisfy reservation_night_rate_amount_nonnegative`,
    });
  }

  const roomChargeCount = reservation.folio?.lineItems.length ?? 0;
  if (roomChargeCount > expectedSchedule.length) {
    notes.push({
      kind: "OVER_POSTED_ROOM_CHARGES",
      reservationId: reservation.id,
      reservationNo: reservation.reservationNo,
      detail: `expected at most ${expectedSchedule.length}, posted=${roomChargeCount}`,
    });
  }

  return expectedSchedule;
}

async function backfillReservation(reservationId: number) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            arrivalDate: true,
            departureDate: true,
            rateAmount: true,
            reservationNights: { select: { id: true } },
          },
        });

        if (!reservation) {
          return { outcome: "concurrent-change" as const, createdNights: 0 };
        }

        // A nonzero schedule is never merged, replaced, or otherwise touched.
        if (reservation.reservationNights.length > 0) {
          return { outcome: "concurrent-change" as const, createdNights: 0 };
        }

        const schedule = createReservationNightSchedule({
          reservationId: reservation.id,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
          rateAmount: reservation.rateAmount,
        });

        if (schedule.length === 0 || reservation.rateAmount.isNegative()) {
          return { outcome: "invalid-legacy-data" as const, createdNights: 0 };
        }

        // The (reservationId, date) unique index is the final duplicate-write
        // safeguard if another writer races this maintenance operation.
        await tx.reservationNight.createMany({ data: schedule });

        return { outcome: "backfilled" as const, createdNights: schedule.length };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );
  } catch (error) {
    if (isRetryableScheduleConflict(error)) {
      return { outcome: "concurrent-change" as const, createdNights: 0 };
    }

    throw error;
  }
}

async function main() {
  const before = await loadReservations();
  const eligible = before.filter(
    (reservation) => reservation.reservationNights.length === 0,
  );
  let backfilledReservations = 0;
  let backfilledNights = 0;
  const backfilledIds = new Set<number>();
  const concurrentChanges: ReconciliationNote[] = [];

  for (const reservation of eligible) {
    const result = await backfillReservation(reservation.id);

    if (result.outcome === "backfilled") {
      backfilledReservations += 1;
      backfilledNights += result.createdNights;
      backfilledIds.add(reservation.id);
    } else if (result.outcome === "concurrent-change") {
      concurrentChanges.push({
        kind: "CONCURRENT_SCHEDULE_CHANGE",
        reservationId: reservation.id,
        reservationNo: reservation.reservationNo,
        detail: "schedule became nonzero or conflicted during the transaction; no rows were changed",
      });
    }
  }

  const after = await loadReservations();
  const notes = [...concurrentChanges];

  for (const reservation of after) {
    reconcileReservation(reservation, notes);
  }
  const equivalence = after
    .filter((reservation) => backfilledIds.has(reservation.id))
    .map((reservation) => {
      const nightCount = reservation.reservationNights.length;
      const total = reservation.reservationNights.reduce(
        (sum, night) => sum.plus(night.rateAmount),
        new Prisma.Decimal(0),
      );

      return {
        reservationNo: reservation.reservationNo,
        nights: nightCount,
        nightlyRate: reservation.rateAmount.toString(),
        nightlySum: total.toString(),
        flatExpected: reservation.rateAmount.mul(nightCount).toString(),
      };
    });

  console.log(
    JSON.stringify(
      {
        operation: "legacy-flat-reservation-night-backfill",
        scope: BACKFILL_SCOPE,
        scannedReservations: before.length,
        reservationsWithExistingNights: before.length - eligible.length,
        eligibleZeroNightReservations: eligible.length,
        backfilledReservations,
        backfilledNights,
        reconciliation: {
          zeroNightReservations: notes.filter(
            (note) => note.kind === "ZERO_NIGHT_RESERVATION",
          ),
          countMismatches: notes.filter(
            (note) => note.kind === "SCHEDULE_COUNT_MISMATCH",
          ),
          fractionalLegacyRates: notes.filter(
            (note) => note.kind === "FRACTIONAL_LEGACY_RATE",
          ),
          overPostedRoomCharges: notes.filter(
            (note) => note.kind === "OVER_POSTED_ROOM_CHARGES",
          ),
          outOfRangeNights: notes.filter(
            (note) => note.kind === "OUT_OF_RANGE_NIGHT",
          ),
          duplicateNights: notes.filter(
            (note) => note.kind === "UNEXPECTED_DUPLICATE_NIGHT",
          ),
          invalidStayRanges: notes.filter(
            (note) => note.kind === "INVALID_STAY_RANGE",
          ),
          negativeLegacyRates: notes.filter(
            (note) => note.kind === "NEGATIVE_LEGACY_RATE",
          ),
          concurrentScheduleChanges: notes.filter(
            (note) => note.kind === "CONCURRENT_SCHEDULE_CHANGE",
          ),
        },
        equivalence,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
