import { Prisma } from "@prisma/client";
import { formatISO } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";
import { dateOnlyRange } from "@/lib/stay-date-range";

type NightlyRate = {
  date: Date;
  rateAmount: Prisma.Decimal;
};

type NightlyRateSummary = {
  count: number;
  total: Prisma.Decimal | null;
  firstDate: Date | null;
  lastDate: Date | null;
};

function dateKey(date: Date) {
  return formatISO(dateOnlyBoundary(date), { representation: "date" });
}

function expectedDateKeys(arrivalDate: Date, departureDate: Date) {
  return dateOnlyRange(dateKey(arrivalDate), dateKey(departureDate));
}

function scalarFallback(rateAmount: Prisma.Decimal, expectedDates: string[]) {
  return rateAmount.mul(expectedDates.length);
}

/**
 * Complete nightly coverage is authoritative. The scalar calculation is retained
 * only as a compatibility fallback for legacy or incomplete snapshots.
 */
export function flatReservationNightStayTotal({
  arrivalDate,
  departureDate,
  rateAmount,
  reservationNights,
}: {
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
  reservationNights: NightlyRate[];
}) {
  const expectedDates = expectedDateKeys(arrivalDate, departureDate);
  const fallbackTotal = scalarFallback(rateAmount, expectedDates);

  if (expectedDates.length === 0 || reservationNights.length !== expectedDates.length) {
    return {
      total: fallbackTotal,
      nightlySchedule: [] as NightlyRate[],
      usesNightlyRates: false,
    };
  }

  const nightlySchedule = [...reservationNights].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
  const hasCompleteDateCoverage = nightlySchedule.every(
    (night, index) => dateKey(night.date) === expectedDates[index],
  );
  const total = nightlySchedule.reduce(
    (sum, night) => sum.plus(night.rateAmount),
    new Prisma.Decimal(0),
  );

  if (!hasCompleteDateCoverage) {
    return {
      total: fallbackTotal,
      nightlySchedule: [] as NightlyRate[],
      usesNightlyRates: false,
    };
  }

  return { total, nightlySchedule, usesNightlyRates: true };
}

export function flatReservationNightSummaryTotal({
  arrivalDate,
  departureDate,
  rateAmount,
  summary,
}: {
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
  summary: NightlyRateSummary | undefined;
}) {
  const expectedDates = expectedDateKeys(arrivalDate, departureDate);
  const fallbackTotal = scalarFallback(rateAmount, expectedDates);

  if (
    !summary ||
    expectedDates.length === 0 ||
    summary.count !== expectedDates.length ||
    !summary.total ||
    !summary.firstDate ||
    !summary.lastDate ||
    dateKey(summary.firstDate) !== expectedDates[0] ||
    dateKey(summary.lastDate) !== expectedDates.at(-1)
  ) {
    return fallbackTotal;
  }

  return summary.total;
}
