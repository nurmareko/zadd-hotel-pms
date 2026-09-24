import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getMealPlanPrices } from "@/lib/arrangement-inclusions";
import { createReservationNightMealSnapshot, createReservationNightSchedule } from "@/lib/reservation-night-schedule";
import { buildReservationMealPlanChange, matchesExpectedMealPlanPreview } from "@/lib/reservation-meal-plan-change";

describe("active meal-plan catalog", () => {
  it("uses catalog values, preserves zero, and falls back for null or missing articles", async () => {
    const client = { article: { findMany: vi.fn().mockResolvedValue([
      { code: "MEAL-BB", defaultPrice: new Prisma.Decimal(0) },
      { code: "MEAL-HB", defaultPrice: new Prisma.Decimal(180000) },
      { code: "MEAL-FB", defaultPrice: null },
    ]) } };
    expect(await getMealPlanPrices(client as unknown as Prisma.TransactionClient))
      .toEqual({ RO: 0, BB: 0, HB: 180000, FB: 250000 });
    client.article.findMany.mockResolvedValue([]);
    expect(await getMealPlanPrices(client as unknown as Prisma.TransactionClient))
      .toEqual({ RO: 0, BB: 50000, HB: 150000, FB: 250000 });
  });
  it("does not hide database failures with fallback prices", async () => {
    const client = { article: { findMany: vi.fn().mockRejectedValue(new Error("offline")) } };
    await expect(getMealPlanPrices(client as unknown as Prisma.TransactionClient)).rejects.toThrow("offline");
  });
});

describe("meal snapshot overrides", () => {
  it.each([0, 65000, 180000])("snapshots explicit whole-IDR price %s", (price) => {
    const result = createReservationNightMealSnapshot("BB", 2, new Prisma.Decimal(price));
    expect(result.mealUnitPrice?.toNumber()).toBe(price);
    expect(result.mealAmount?.toNumber()).toBe(price * 2);
  });
  it("retains a stored unit price when changing pax", () => {
    const previous = createReservationNightMealSnapshot("BB", 1, new Prisma.Decimal(65000));
    const updated = createReservationNightMealSnapshot("BB", 3, previous.mealUnitPrice);
    expect(updated.mealUnitPrice?.toString()).toBe("65000");
    expect(updated.mealAmount?.toString()).toBe("195000");
    expect(previous.mealAmount?.toString()).toBe("65000");
  });
  it("uses fallback for a nullable override and ignores overrides for RO", () => {
    expect(createReservationNightMealSnapshot("BB", 2, null).mealUnitPrice?.toNumber()).toBe(50000);
    expect(createReservationNightMealSnapshot("RO", 2, new Prisma.Decimal(65000)))
      .toEqual({ mealPlan: null, mealPax: null, mealUnitPrice: null, mealAmount: null });
  });
  it("passes catalog prices through schedule generation", () => {
    const schedule = createReservationNightSchedule({ reservationId: 1,
      arrivalDate: new Date("2026-10-01"), departureDate: new Date("2026-10-03"),
      rateAmount: new Prisma.Decimal(500000),
      mealSnapshot: { arrangementType: "BB", mealPax: 2, unitPriceOverride: new Prisma.Decimal(65000) },
    });
    expect(schedule.map((night) => String(night.mealAmount))).toEqual(["130000", "130000"]);
  });
  it("prices only eligible nights at the target price and rejects stale price previews", () => {
    const input = { reservationId: 1, groupBookingId: null, status: "CONFIRMED" as const,
      currentPlan: "BB" as const, targetPlan: "HB" as const, adults: 2, children: 0, roomCapacity: 2,
      nights: [{ id: "posted", date: new Date("2026-10-01"), posted: true },
        { id: "future", date: new Date("2026-10-02"), posted: false }],
    };
    const old = buildReservationMealPlanChange(input);
    const current = buildReservationMealPlanChange({ ...input, unitPriceOverride: new Prisma.Decimal(180000) });
    expect(current.ok).toBe(true);
    if (!current.ok || !old.ok) throw new Error("Expected eligible plan change");
    expect(current.snapshot.eligibleNightIds).toEqual(["future"]);
    expect(current.snapshot.expectedAmount).toBe("360000");
    expect(matchesExpectedMealPlanPreview(current.snapshot, old.snapshot)).toBe(false);
  });
});
