import { ArrangementType, Prisma, ReservationStatus } from "@prisma/client";
import { formatISO } from "date-fns";

import { createReservationNightMealSnapshot } from "@/lib/reservation-night-schedule";

type MealPlanChangeNight = {
  id: string;
  date: Date;
  rateAmount: Prisma.Decimal;
  posted: boolean;
};

export type MealPlanChangeSnapshot = {
  reservationId: number;
  groupBookingId: string | null;
  reservationStatus: ReservationStatus;
  currentPlan: ArrangementType;
  adults: number;
  children: number;
  pax: number;
  eligibleNightIds: string[];
  nightsAffected: number;
  unitPrice: string;
  nightlyAmount: string;
  expectedAmount: string;
  effectiveDate: string;
};

type MealPlanChangeBuildResult =
  | { ok: true; snapshot: MealPlanChangeSnapshot; data: Prisma.ReservationNightUpdateManyMutationInput }
  | { ok: false; error: string; disposition: "skipped" | "failed" };

export type ExpectedMealPlanPreview = Pick<
  MealPlanChangeSnapshot,
  | "reservationId"
  | "groupBookingId"
  | "reservationStatus"
  | "currentPlan"
  | "pax"
  | "nightsAffected"
  | "unitPrice"
  | "nightlyAmount"
  | "expectedAmount"
  | "effectiveDate"
>;

export function buildReservationMealPlanChange(input: {
  reservationId: number;
  groupBookingId: string | null;
  expectedGroupBookingId?: string;
  status: ReservationStatus;
  currentPlan: ArrangementType;
  targetPlan: ArrangementType;
  unitPriceOverride?: Prisma.Decimal | null;
  // Catalog-priced callers also pass an override; only operator price edits opt in.
  allowSamePlanPriceChange?: boolean;
  adults: number;
  children: number;
  roomCapacity: number;
  nights: MealPlanChangeNight[];
}): MealPlanChangeBuildResult {
  if (
    input.expectedGroupBookingId &&
    input.groupBookingId !== input.expectedGroupBookingId
  ) {
    return {
      ok: false,
      error: "The reservation does not belong to this group booking.",
      disposition: "failed",
    };
  }

  if (
    input.status === ReservationStatus.CHECKED_OUT ||
    input.status === ReservationStatus.CANCELLED ||
    input.status === ReservationStatus.NO_SHOW
  ) {
    return {
      ok: false,
      error: "Arrangement history for a finalized reservation cannot be changed.",
      disposition: "skipped",
    };
  }

  const pax = input.adults + input.children;
  if (!Number.isInteger(pax) || pax < 1) {
    return {
      ok: false,
      error: "Invalid reservation pax; the Arrangement was not applied.",
      disposition: "failed",
    };
  }

  if (!Number.isInteger(input.roomCapacity) || pax > input.roomCapacity) {
    return {
      ok: false,
      error: `Pax ${pax} exceeds the room capacity of ${input.roomCapacity}; the Arrangement was not applied.`,
      disposition: "failed",
    };
  }

  const priceOnlyChange =
    input.allowSamePlanPriceChange === true &&
    input.unitPriceOverride != null &&
    input.targetPlan !== ArrangementType.RO;
  if (input.currentPlan === input.targetPlan && !priceOnlyChange) {
    return {
      ok: false,
      error: "This room already uses the selected Arrangement package.",
      disposition: "skipped",
    };
  }

  const eligibleNights = input.nights.filter((night) => !night.posted);
  const firstEligibleNight = eligibleNights[0];
  if (!firstEligibleNight) {
    return {
      ok: false,
      error: "There are no unposted future nights to change.",
      disposition: "skipped",
    };
  }

  const data = createReservationNightMealSnapshot(input.targetPlan, pax, input.unitPriceOverride);
  const nightlyAmount = data.mealAmount ?? new Prisma.Decimal(0);
  const overAllocatedNight = eligibleNights.find((night) =>
    nightlyAmount.greaterThan(night.rateAmount),
  );
  if (overAllocatedNight) {
    const date = formatISO(overAllocatedNight.date, { representation: "date" });
    return {
      ok: false,
      error: `The Arrangement allocation for ${date} of IDR ${nightlyAmount.toString()} (${pax} pax) exceeds the package rate of IDR ${overAllocatedNight.rateAmount.toString()}. Reduce the Arrangement unit price; the net room amount must not be negative.`,
      disposition: "failed",
    };
  }

  return {
    ok: true,
    data,
    snapshot: {
      reservationId: input.reservationId,
      groupBookingId: input.groupBookingId,
      reservationStatus: input.status,
      currentPlan: input.currentPlan,
      adults: input.adults,
      children: input.children,
      pax,
      eligibleNightIds: eligibleNights.map((night) => night.id),
      nightsAffected: eligibleNights.length,
      unitPrice: data.mealUnitPrice?.toString() ?? "0",
      nightlyAmount: nightlyAmount.toString(),
      expectedAmount: nightlyAmount.mul(eligibleNights.length).toString(),
      effectiveDate: formatISO(firstEligibleNight.date, {
        representation: "date",
      }),
    },
  };
}

export function matchesExpectedMealPlanPreview(
  snapshot: MealPlanChangeSnapshot,
  expected: ExpectedMealPlanPreview,
) {
  return (
    snapshot.reservationId === expected.reservationId &&
    snapshot.groupBookingId === expected.groupBookingId &&
    snapshot.reservationStatus === expected.reservationStatus &&
    snapshot.currentPlan === expected.currentPlan &&
    snapshot.pax === expected.pax &&
    snapshot.nightsAffected === expected.nightsAffected &&
    snapshot.unitPrice === expected.unitPrice &&
    snapshot.nightlyAmount === expected.nightlyAmount &&
    snapshot.expectedAmount === expected.expectedAmount &&
    snapshot.effectiveDate === expected.effectiveDate
  );
}
