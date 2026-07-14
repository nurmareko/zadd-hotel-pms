import {
  Prisma,
  ReservationNightRevenueClass,
} from "@prisma/client";
import { addDays } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";

/**
 * Builds the immutable date-only nightly schedule for a stay. Callers choose
 * the already-locked nightly rate; this helper never derives a price.
 */
export function createReservationNightSchedule({
  reservationId,
  arrivalDate,
  departureDate,
  rateAmount,
}: {
  reservationId: number;
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
}): Prisma.ReservationNightCreateManyInput[] {
  const nights: Prisma.ReservationNightCreateManyInput[] = [];
  const departure = dateOnlyBoundary(departureDate);

  for (
    let date = dateOnlyBoundary(arrivalDate);
    date < departure;
    date = addDays(date, 1)
  ) {
    nights.push({
      reservationId,
      date,
      rateAmount,
      revenueClass: ReservationNightRevenueClass.PAID,
      sourcePricingRuleId: null,
    });
  }

  return nights;
}
