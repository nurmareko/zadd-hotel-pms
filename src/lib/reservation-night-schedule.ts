import {
  type ArrangementType,
  Prisma,
  ReservationNightRevenueClass,
} from "@prisma/client";
import { addDays } from "date-fns";

import { MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { dateOnlyBoundary } from "@/lib/date-only";
import type { ResolvedNightlyRate } from "@/lib/pricing-resolver";

type MealSnapshotInput = {
  arrangementType: ArrangementType;
  mealPax: number;
  fromDate?: Date;
};

type ResolvedScheduleInput = {
  reservationId: number;
  resolvedSchedule: ResolvedNightlyRate[];
  mealSnapshot?: MealSnapshotInput;
};

type LegacyFlatScheduleInput = {
  reservationId: number;
  arrivalDate: Date;
  departureDate: Date;
  rateAmount: Prisma.Decimal;
  mealSnapshot?: MealSnapshotInput;
};

export type ReservationNightMealSnapshot = {
  mealPlan: ArrangementType | null;
  mealPax: number | null;
  mealUnitPrice: Prisma.Decimal | null;
  mealAmount: Prisma.Decimal | null;
};

export function createReservationNightMealSnapshot(
  arrangementType: ArrangementType,
  mealPax: number,
): ReservationNightMealSnapshot {
  const definition = MEAL_PLAN_DEFINITIONS[arrangementType];

  if (!definition) {
    return {
      mealPlan: null,
      mealPax: null,
      mealUnitPrice: null,
      mealAmount: null,
    };
  }

  if (!Number.isInteger(mealPax) || mealPax < 1) {
    throw new RangeError("Meal snapshot pax must be a positive integer.");
  }

  const mealUnitPrice = new Prisma.Decimal(definition.unitPrice);

  return {
    mealPlan: arrangementType,
    mealPax,
    mealUnitPrice,
    mealAmount: mealUnitPrice.mul(mealPax),
  };
}

function mealSnapshotForNight(date: Date, input?: MealSnapshotInput) {
  if (!input || (input.fromDate && date < dateOnlyBoundary(input.fromDate))) {
    return {};
  }

  return createReservationNightMealSnapshot(
    input.arrangementType,
    input.mealPax,
  );
}

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
      ...mealSnapshotForNight(night.date, input.mealSnapshot),
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
      ...mealSnapshotForNight(date, input.mealSnapshot),
      revenueClass: ReservationNightRevenueClass.PAID,
      sourcePricingRuleId: null,
    });
  }

  return nights;
}
