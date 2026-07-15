import {
  Prisma,
  ReservationNightRevenueClass,
} from "@prisma/client";
import { addDays } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";
import type { ResolvedNightlyRate } from "@/lib/pricing-resolver";

type ResolvedScheduleInput = {
  reservationId: number;
  resolvedSchedule: ResolvedNightlyRate[];
};

type LegacyFlatScheduleInput = {
  reservationId: number;
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
};

/**
 * Maps an already-resolved schedule into the immutable reservation snapshot.
 * The flat input remains available only for the explicit legacy backfill.
 */
export function createReservationNightSchedule(
  input: ResolvedScheduleInput | LegacyFlatScheduleInput,
): Prisma.ReservationNightCreateManyInput[] {
  if ("resolvedSchedule" in input) {
    return input.resolvedSchedule.map((night) => ({
      reservationId: input.reservationId,
      date: night.date,
      rateAmount: night.rate,
      revenueClass: ReservationNightRevenueClass.PAID,
      sourcePricingRuleId: night.sourceRule?.id ?? null,
    }));
  }

  const nights: Prisma.ReservationNightCreateManyInput[] = [];
  const departure = dateOnlyBoundary(input.departureDate);

  for (
    let date = dateOnlyBoundary(input.arrivalDate);
    date < departure;
    date = addDays(date, 1)
  ) {
    nights.push({
      reservationId: input.reservationId,
      date,
      rateAmount: input.rateAmount,
      revenueClass: ReservationNightRevenueClass.PAID,
      sourcePricingRuleId: null,
    });
  }

  return nights;
}
