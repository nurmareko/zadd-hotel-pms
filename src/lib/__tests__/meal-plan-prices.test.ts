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

describe("Arrangement package-rate limits", () => {
  const input = {
    reservationId: 1, groupBookingId: null, status: "CONFIRMED" as const,
    currentPlan: "RO" as const, targetPlan: "BB" as const,
    adults: 2, children: 1, roomCapacity: 3,
    unitPriceOverride: new Prisma.Decimal(50000),
    nights: [
      { id: "room-posted", date: new Date("2026-10-01"), posted: true, rateAmount: new Prisma.Decimal(0) },
      { id: "eligible-1", date: new Date("2026-10-02"), posted: false, rateAmount: new Prisma.Decimal(500000) },
      { id: "eligible-2", date: new Date("2026-10-03"), posted: false, rateAmount: new Prisma.Decimal(149999) },
    ],
  };

  it("rejects allocation above any eligible night's rate, not just the first or aggregate rate", () => {
    expect(buildReservationMealPlanChange(input)).toMatchObject({
      ok: false, disposition: "failed",
      error: expect.stringMatching(/Arrangement allocation.*2026-10-03.*150000.*149999/),
    });
  });

  it("checks the package cap for same-plan price-only edits too", () => {
    expect(buildReservationMealPlanChange({
      ...input, currentPlan: "BB", allowSamePlanPriceChange: true,
    })).toMatchObject({ ok: false, disposition: "failed" });
  });

  it("accepts equality and ignores locked nights with lower package rates", () => {
    const result = buildReservationMealPlanChange({
      ...input,
      nights: input.nights.map((night) => night.id === "eligible-2"
        ? { ...night, rateAmount: new Prisma.Decimal(150000) } : night),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.eligibleNightIds).toEqual(["eligible-1", "eligible-2"]);
    expect(result.snapshot.nightlyAmount).toBe("150000");
  });

  it.each([0, 1])("handles a zero package rate with override %s without changing quote policy", (price) => {
    const result = buildReservationMealPlanChange({
      ...input, unitPriceOverride: new Prisma.Decimal(price),
      nights: [{ ...input.nights[1], rateAmount: new Prisma.Decimal(0) }],
    });
    expect(result.ok).toBe(price === 0);
  });
});

describe("same-plan price changes", () => {
  const input = {
    reservationId: 1,
    groupBookingId: "group-1",
    expectedGroupBookingId: "group-1",
    status: "CONFIRMED" as const,
    currentPlan: "BB" as const,
    targetPlan: "BB" as const,
    adults: 2,
    children: 1,
    roomCapacity: 3,
    nights: [
      { id: "posted", date: new Date("2026-10-01"), posted: true, rateAmount: new Prisma.Decimal(500000) },
      { id: "future-1", date: new Date("2026-10-02"), posted: false, rateAmount: new Prisma.Decimal(500000) },
      { id: "future-2", date: new Date("2026-10-03"), posted: false, rateAmount: new Prisma.Decimal(500000) },
    ],
  };

  it.each([0, 65000])("applies explicit same-plan price %s only to unposted nights", (price) => {
    const result = buildReservationMealPlanChange({
      ...input,
      allowSamePlanPriceChange: true,
      unitPriceOverride: new Prisma.Decimal(price),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.eligibleNightIds).toEqual(["future-1", "future-2"]);
    expect(result.snapshot.pax).toBe(3);
    expect(result.snapshot.unitPrice).toBe(String(price));
    expect(result.snapshot.nightlyAmount).toBe(String(price * 3));
    expect(result.snapshot.expectedAmount).toBe(String(price * 3 * 2));
    expect(result.data.mealPlan).toBe("BB");
    expect(String(result.data.mealUnitPrice)).toBe(String(price));
  });

  it.each([undefined, null, new Prisma.Decimal(65000)])(
    "keeps default/group same-plan requests skipped with price %s",
    (unitPriceOverride) => {
      expect(buildReservationMealPlanChange({ ...input, unitPriceOverride }))
        .toMatchObject({ ok: false, disposition: "skipped" });
    },
  );

  it.each([undefined, null])("requires an actual price even with opt-in: %s", (unitPriceOverride) => {
    expect(buildReservationMealPlanChange({
      ...input, allowSamePlanPriceChange: true, unitPriceOverride,
    })).toMatchObject({ ok: false, disposition: "skipped" });
  });

  it("does not create a price-only change for RO", () => {
    expect(buildReservationMealPlanChange({
      ...input, currentPlan: "RO", targetPlan: "RO",
      allowSamePlanPriceChange: true, unitPriceOverride: new Prisma.Decimal(65000),
    })).toMatchObject({ ok: false, disposition: "skipped" });
  });

  it.each([
    { status: "CHECKED_OUT" as const },
    { status: "CANCELLED" as const },
    { status: "NO_SHOW" as const },
    { nights: input.nights.map((night) => ({ ...night, posted: true })) },
    { groupBookingId: "different-group" },
    { adults: 4 },
    { adults: 0, children: 0 },
  ])("preserves eligibility guards for price-only changes: %j", (overrides) => {
    expect(buildReservationMealPlanChange({
      ...input, ...overrides,
      allowSamePlanPriceChange: true, unitPriceOverride: new Prisma.Decimal(65000),
    }).ok).toBe(false);
  });

  it("still rejects a preview with a different same-plan price", () => {
    const old = buildReservationMealPlanChange({
      ...input, allowSamePlanPriceChange: true, unitPriceOverride: new Prisma.Decimal(50000),
    });
    const updated = buildReservationMealPlanChange({
      ...input, allowSamePlanPriceChange: true, unitPriceOverride: new Prisma.Decimal(65000),
    });
    expect(old.ok && updated.ok).toBe(true);
    if (!old.ok || !updated.ok) throw new Error("Expected price-only changes");
    expect(matchesExpectedMealPlanPreview(updated.snapshot, old.snapshot)).toBe(false);
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
      nights: [{ id: "posted", date: new Date("2026-10-01"), posted: true, rateAmount: new Prisma.Decimal(500000) },
        { id: "future", date: new Date("2026-10-02"), posted: false, rateAmount: new Prisma.Decimal(500000) }],
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
