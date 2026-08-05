import {
  PricingRuleAdjustmentKind,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { applyPricingRuleAdjustment } from "@/lib/pricing-resolver";
import { buildReservationMealPlanChange } from "@/lib/reservation-meal-plan-change";
import {
  createReservationNightMealSnapshot,
  createReservationNightSchedule,
} from "@/lib/reservation-night-schedule";

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function amount(value: Prisma.Decimal | null) {
  return value?.toNumber() ?? null;
}

describe("reservation meal snapshots", () => {
  it.each([
    ["BB", 1, 50_000],
    ["BB", 2, 100_000],
    ["BB", 3, 150_000],
    ["HB", 2, 300_000],
    ["FB", 2, 500_000],
  ] as const)("snapshots %s for %i pax as %i", (plan, pax, expected) => {
    const snapshot = createReservationNightMealSnapshot(plan, pax);

    expect(snapshot.mealPlan).toBe(plan);
    expect(snapshot.mealPax).toBe(pax);
    expect(amount(snapshot.mealAmount)).toBe(expected);
  });

  it("keeps RO meal snapshot fields null", () => {
    expect(createReservationNightMealSnapshot("RO", 3)).toEqual({
      mealPlan: null,
      mealPax: null,
      mealUnitPrice: null,
      mealAmount: null,
    });
  });

  it("uses adults plus children as the supplied pax snapshot", () => {
    const adults = 2;
    const children = 1;
    const snapshot = createReservationNightMealSnapshot(
      "BB",
      adults + children,
    );

    expect(snapshot.mealPax).toBe(3);
    expect(amount(snapshot.mealAmount)).toBe(150_000);
  });
});

describe("buildReservationMealPlanChange", () => {
  it("computes the future unposted-night meal amount from adults plus children", () => {
    const result = buildReservationMealPlanChange({
      reservationId: 1,
      groupBookingId: null,
      status: "CONFIRMED",
      currentPlan: "RO",
      targetPlan: "BB",
      adults: 2,
      children: 1,
      roomCapacity: 3,
      nights: [
        { id: "posted", date: date("2026-08-01"), posted: true },
        { id: "future-1", date: date("2026-08-02"), posted: false },
        { id: "future-2", date: date("2026-08-03"), posted: false },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.snapshot.pax).toBe(3);
    expect(result.snapshot.nightlyAmount).toBe("150000");
    expect(result.snapshot.nightsAffected).toBe(2);
    expect(result.snapshot.expectedAmount).toBe("300000");
  });
});

describe("applyPricingRuleAdjustment", () => {
  it("applies a ten-percent Saturday-style surcharge to the base rate", () => {
    const resolved = applyPricingRuleAdjustment(
      new Prisma.Decimal(550_000),
      PricingRuleAdjustmentKind.PERCENT_DELTA,
      new Prisma.Decimal(10),
    );

    expect(resolved.toNumber()).toBe(605_000);
  });

  it("rounds percentage adjustments half-up to whole IDR", () => {
    const resolved = applyPricingRuleAdjustment(
      new Prisma.Decimal(10),
      PricingRuleAdjustmentKind.PERCENT_DELTA,
      new Prisma.Decimal(5),
    );

    expect(resolved.toNumber()).toBe(11);
  });
});

describe("first-night snapshot semantics", () => {
  it.each([
    [[550_000, 605_000], 550_000],
    [[605_000, 550_000], 605_000],
  ])("keeps the first schedule rate as the compatibility value", (rates, expected) => {
    const schedule = createReservationNightSchedule({
      reservationId: 1,
      resolvedSchedule: rates.map((rate, index) => ({
        date: date(`2026-08-0${index + 1}`),
        rate: new Prisma.Decimal(rate),
        baseRate: new Prisma.Decimal(550_000),
        sourceRule: null,
      })),
    });

    expect(schedule[0].rateAmount.toString()).toBe(expected.toString());
  });
});

describe("flatReservationNightStayTotal", () => {
  const arrivalDate = date("2026-08-01");
  const departureDate = date("2026-08-03");
  const rateAmount = new Prisma.Decimal(550_000);

  it("sums a complete nightly schedule", () => {
    const result = flatReservationNightStayTotal({
      arrivalDate,
      departureDate,
      rateAmount,
      reservationNights: [
        { date: date("2026-08-01"), rateAmount: new Prisma.Decimal(550_000) },
        { date: date("2026-08-02"), rateAmount: new Prisma.Decimal(605_000) },
      ],
    });

    expect(result.total.toNumber()).toBe(1_155_000);
    expect(result.usesNightlyRates).toBe(true);
  });

  it("uses the scalar fallback for a missing nightly snapshot", () => {
    const result = flatReservationNightStayTotal({
      arrivalDate,
      departureDate,
      rateAmount,
      reservationNights: [
        { date: date("2026-08-01"), rateAmount: new Prisma.Decimal(605_000) },
      ],
    });

    expect(result.total.toNumber()).toBe(1_100_000);
    expect(result.usesNightlyRates).toBe(false);
    expect(result.nightlySchedule).toEqual([]);
  });

  it("uses the scalar fallback when count matches but date coverage is not equivalent", () => {
    const result = flatReservationNightStayTotal({
      arrivalDate,
      departureDate,
      rateAmount,
      reservationNights: [
        { date: date("2026-08-01"), rateAmount: new Prisma.Decimal(550_000) },
        { date: date("2026-08-03"), rateAmount: new Prisma.Decimal(605_000) },
      ],
    });

    expect(result.total.toNumber()).toBe(1_100_000);
    expect(result.usesNightlyRates).toBe(false);
  });
});
