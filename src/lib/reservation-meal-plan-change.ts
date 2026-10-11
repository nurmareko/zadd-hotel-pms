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
      error: "Riwayat Arrangement reservasi final tidak dapat diubah.",
      disposition: "skipped",
    };
  }

  const pax = input.adults + input.children;
  if (!Number.isInteger(pax) || pax < 1) {
    return {
      ok: false,
      error: "Pax reservasi tidak valid; Arrangement tidak diterapkan.",
      disposition: "failed",
    };
  }

  if (!Number.isInteger(input.roomCapacity) || pax > input.roomCapacity) {
    return {
      ok: false,
      error: `Pax ${pax} melebihi kapasitas kamar ${input.roomCapacity}; Arrangement tidak diterapkan.`,
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
      error: "Arrangement kamar ini sudah menggunakan paket yang dipilih.",
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

  const data = createReservationNightMealSnapshot(input.targetPlan, pax, input.unitPriceOverride);
  const nightlyAmount = data.mealAmount ?? new Prisma.Decimal(0);
  const overAllocatedNight = eligibleNights.find((night) =>
    nightlyAmount.greaterThan(night.rateAmount),
  );
  if (overAllocatedNight) {
    const date = formatISO(overAllocatedNight.date, { representation: "date" });
    return {
      ok: false,
      error: `Alokasi Arrangement untuk malam ${date} sebesar IDR ${nightlyAmount.toString()} (${pax} pax) melebihi tarif paket IDR ${overAllocatedNight.rateAmount.toString()}. Kurangi harga satuan Arrangement; net kamar tidak boleh negatif.`,
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
