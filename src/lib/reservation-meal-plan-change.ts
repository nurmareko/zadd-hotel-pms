import { ArrangementType, Prisma, ReservationStatus } from "@prisma/client";
import { formatISO } from "date-fns";

import { createReservationNightMealSnapshot } from "@/lib/reservation-night-schedule";

type MealPlanChangeNight = {
  id: string;
  date: Date;
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
      error: "Reservasi bukan anggota booking grup ini.",
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
      error: "Riwayat Inklusi reservasi terminal bersifat final dan tidak dapat diubah.",
      disposition: "skipped",
    };
  }

  const pax = input.adults + input.children;
  if (!Number.isInteger(pax) || pax < 1) {
    return {
      ok: false,
      error: "Pax reservasi tidak valid; meal plan tidak diterapkan.",
      disposition: "failed",
    };
  }

  if (!Number.isInteger(input.roomCapacity) || pax > input.roomCapacity) {
    return {
      ok: false,
      error: `Pax ${pax} melebihi kapasitas kamar ${input.roomCapacity}; meal plan tidak diterapkan.`,
      disposition: "failed",
    };
  }

  if (input.currentPlan === input.targetPlan) {
    return {
      ok: false,
      error: "Meal plan kamar ini sudah menggunakan paket yang dipilih.",
      disposition: "skipped",
    };
  }

  const eligibleNights = input.nights.filter((night) => !night.posted);
  const firstEligibleNight = eligibleNights[0];
  if (!firstEligibleNight) {
    return {
      ok: false,
      error: "Tidak ada malam mendatang yang belum diposting untuk diubah.",
      disposition: "skipped",
    };
  }

  const data = createReservationNightMealSnapshot(input.targetPlan, pax);
  const nightlyAmount = data.mealAmount ?? new Prisma.Decimal(0);

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
