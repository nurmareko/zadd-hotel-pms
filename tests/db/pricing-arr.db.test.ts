import {
  ArticleType,
  PricingRuleAdjustmentKind,
  PricingRuleDayOfWeek,
  PricingRuleSelectorKind,
  ReservationNightRevenueClass,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { computeArr } from "@/lib/arr";
import { parseISODateOnly } from "@/lib/date-only";
import {
  PricingResolutionError,
  resolveNightlySchedule,
} from "@/lib/pricing-resolver";
import { prisma } from "@/lib/prisma";

import {
  createArticle,
  createFolio,
  createFolioLine,
  createGuest,
  createReservationFixture,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-05T05:00:00.000Z"));
});

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("pricing resolver with persisted rules", () => {
  it("uses the Rp 550.000 base rate when no rule exists", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-08",
      departureDate: "2026-08-09",
    });
    const resolved = schedule[0];

    expect(resolved.rate.toNumber()).toBe(550_000);
    expect(resolved.baseRate.toNumber()).toBe(550_000);
    expect(resolved.sourceRule).toBeNull();
  });

  it("applies a 10% Saturday rule to resolve Rp 605.000", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    const rule = await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Saturday surcharge",
        selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
        dayOfWeek: PricingRuleDayOfWeek.SATURDAY,
        adjustmentKind: PricingRuleAdjustmentKind.PERCENT_DELTA,
        adjustmentValue: 10,
      },
    });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-08",
      departureDate: "2026-08-09",
    });
    const resolved = schedule[0];

    expect(resolved.rate.toNumber()).toBe(605_000);
    expect(resolved.sourceRule).toEqual({
      id: rule.id,
      name: rule.name,
      selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
    });
  });

  it("treats date ranges as startsOn-inclusive and endsBefore-exclusive", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    const rule = await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "August promotion",
        selectorKind: PricingRuleSelectorKind.DATE_RANGE,
        startsOn: parseISODateOnly("2026-08-08"),
        endsBefore: parseISODateOnly("2026-08-10"),
        adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
        adjustmentValue: 100_000,
      },
    });

    const atStart = (
      await resolveNightlySchedule({
        roomTypeId: roomType.id,
        arrivalDate: "2026-08-08",
        departureDate: "2026-08-09",
      })
    )[0];
    const beforeEnd = (
      await resolveNightlySchedule({
        roomTypeId: roomType.id,
        arrivalDate: "2026-08-09",
        departureDate: "2026-08-10",
      })
    )[0];
    const atEnd = (
      await resolveNightlySchedule({
        roomTypeId: roomType.id,
        arrivalDate: "2026-08-10",
        departureDate: "2026-08-11",
      })
    )[0];

    expect(atStart.rate.toNumber()).toBe(650_000);
    expect(atStart.sourceRule?.id).toBe(rule.id);
    expect(beforeEnd.rate.toNumber()).toBe(650_000);
    expect(beforeEnd.sourceRule?.id).toBe(rule.id);
    expect(atEnd.rate.toNumber()).toBe(550_000);
    expect(atEnd.sourceRule).toBeNull();
  });

  it("ignores inactive matching rules", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Inactive Saturday surcharge",
        selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
        dayOfWeek: PricingRuleDayOfWeek.SATURDAY,
        adjustmentKind: PricingRuleAdjustmentKind.PERCENT_DELTA,
        adjustmentValue: 10,
        isActive: false,
      },
    });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-08",
      departureDate: "2026-08-09",
    });
    const resolved = schedule[0];

    expect(resolved.rate.toNumber()).toBe(550_000);
    expect(resolved.sourceRule).toBeNull();
  });

  it("gives a matching date range precedence over a weekday without stacking", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Saturday surcharge",
        selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
        dayOfWeek: PricingRuleDayOfWeek.SATURDAY,
        adjustmentKind: PricingRuleAdjustmentKind.PERCENT_DELTA,
        adjustmentValue: 10,
      },
    });
    const rangeRule = await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Holiday surcharge",
        selectorKind: PricingRuleSelectorKind.DATE_RANGE,
        startsOn: parseISODateOnly("2026-08-08"),
        endsBefore: parseISODateOnly("2026-08-09"),
        adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
        adjustmentValue: 100_000,
      },
    });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-08",
      departureDate: "2026-08-09",
    });
    const resolved = schedule[0];

    expect(resolved.rate.toNumber()).toBe(650_000);
    expect(resolved.rate.toNumber()).not.toBe(705_000);
    expect(resolved.sourceRule?.id).toBe(rangeRule.id);
  });

  it("fails closed when active date ranges overlap", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.createMany({
      data: [
        {
          roomTypeId: roomType.id,
          name: "First range",
          selectorKind: PricingRuleSelectorKind.DATE_RANGE,
          startsOn: parseISODateOnly("2026-08-08"),
          endsBefore: parseISODateOnly("2026-08-11"),
          adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
          adjustmentValue: 50_000,
        },
        {
          roomTypeId: roomType.id,
          name: "Second range",
          selectorKind: PricingRuleSelectorKind.DATE_RANGE,
          startsOn: parseISODateOnly("2026-08-09"),
          endsBefore: parseISODateOnly("2026-08-12"),
          adjustmentKind: PricingRuleAdjustmentKind.PERCENT_DELTA,
          adjustmentValue: 10,
        },
      ],
    });

    await expect(
      resolveNightlySchedule({
        roomTypeId: roomType.id,
        arrivalDate: "2026-08-09",
        departureDate: "2026-08-10",
      }),
    ).rejects.toBeInstanceOf(PricingResolutionError);
  });

  it.each([
    ["zero", -550_000],
    ["negative", -550_001],
  ])("rejects a %s resolved nightly rate", async (_label, adjustmentValue) => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Invalid discount",
        selectorKind: PricingRuleSelectorKind.DATE_RANGE,
        startsOn: parseISODateOnly("2026-08-08"),
        endsBefore: parseISODateOnly("2026-08-09"),
        adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
        adjustmentValue,
      },
    });

    await expect(
      resolveNightlySchedule({
        roomTypeId: roomType.id,
        arrivalDate: "2026-08-08",
        departureDate: "2026-08-09",
      }),
    ).rejects.toBeInstanceOf(PricingResolutionError);
  });

  it("resolves a multi-night stay in ascending order with a weekday rule on matching nights only", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "Saturday surcharge",
        selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
        dayOfWeek: PricingRuleDayOfWeek.SATURDAY,
        adjustmentKind: PricingRuleAdjustmentKind.PERCENT_DELTA,
        adjustmentValue: 10,
      },
    });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-07",
      departureDate: "2026-08-10",
    });

    expect(schedule).toHaveLength(3);
    expect(schedule.map((night) => night.date.toISOString().slice(0, 10))).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
    expect(schedule.map((night) => night.rate.toNumber())).toEqual([
      550_000,
      605_000,
      550_000,
    ]);
  });

  it("applies a date-range rule only to nights inside its boundary", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });
    await prisma.pricingRule.create({
      data: {
        roomTypeId: roomType.id,
        name: "August promotion",
        selectorKind: PricingRuleSelectorKind.DATE_RANGE,
        startsOn: parseISODateOnly("2026-08-08"),
        endsBefore: parseISODateOnly("2026-08-10"),
        adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
        adjustmentValue: 100_000,
      },
    });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-07",
      departureDate: "2026-08-11",
    });

    expect(schedule.map((night) => night.date.toISOString().slice(0, 10))).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
    expect(schedule.map((night) => night.rate.toNumber())).toEqual([
      550_000,
      650_000,
      650_000,
      550_000,
    ]);
  });

  it("returns exactly one entry per night and excludes the departure date", async () => {
    const roomType = await createRoomType({ baseRate: 550_000 });

    const schedule = await resolveNightlySchedule({
      roomTypeId: roomType.id,
      arrivalDate: "2026-08-08",
      departureDate: "2026-08-12",
    });
    const dates = schedule.map((night) => night.date.toISOString().slice(0, 10));

    expect(schedule).toHaveLength(4);
    expect(dates).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(dates).not.toContain("2026-08-12");
    expect(schedule.map((night) => night.rate.toNumber())).toEqual([
      550_000,
      550_000,
      550_000,
      550_000,
    ]);
  });
});

describe("ARR with persisted folio lines", () => {
  it("computes Rp 1.800.000 / 2 = Rp 900.000 while excluding meals, fees, and COMP", async () => {
    const user = await createUser();
    const roomType = await createRoomType({ baseRate: 900_000 });
    const guest = await createGuest();
    const { reservation, nights } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-01-05",
      nightlyRates: [900_000, 900_000, 2_000_000],
      revenueClasses: [
        ReservationNightRevenueClass.PAID,
        ReservationNightRevenueClass.PAID,
        ReservationNightRevenueClass.COMP,
      ],
    });
    const folio = await createFolio(reservation.id);
    const roomCharge = await createArticle({
      code: "ROOM-CHARGE",
      type: ArticleType.ROOM,
      defaultPrice: 900_000,
    });
    const meal = await createArticle({
      code: "MEAL-BB",
      type: ArticleType.FB,
      defaultPrice: 50_000,
    });
    const fee = await createArticle({
      code: "EARLY-CHECK-IN",
      type: ArticleType.MISC,
      defaultPrice: 100_000,
    });

    await createFolioLine({
      folioId: folio.id,
      articleId: roomCharge.id,
      postedById: user.id,
      reservationNightId: nights[0].id,
      amount: 900_000,
    });
    await createFolioLine({
      folioId: folio.id,
      articleId: roomCharge.id,
      postedById: user.id,
      reservationNightId: nights[1].id,
      amount: 900_000,
    });
    await createFolioLine({
      folioId: folio.id,
      articleId: roomCharge.id,
      postedById: user.id,
      reservationNightId: nights[2].id,
      amount: 2_000_000,
    });
    await createFolioLine({
      folioId: folio.id,
      articleId: meal.id,
      postedById: user.id,
      reservationNightId: nights[0].id,
      quantity: 2,
      unitPrice: 50_000,
      amount: 100_000,
    });
    await createFolioLine({
      folioId: folio.id,
      articleId: fee.id,
      postedById: user.id,
      amount: 100_000,
    });

    const result = await computeArr({
      fromInclusive: parseISODateOnly("2026-01-05"),
      toExclusive: parseISODateOnly("2026-01-08"),
      resolvedCutover: {
        ok: true,
        date: parseISODateOnly("2026-01-01"),
        source: "CONFIG",
      },
    });

    expect(result.status).toBe("AUTHORITATIVE");
    expect(result.numerator.toNumber()).toBe(1_800_000);
    expect(result.paidRoomNights).toBe(2);
    expect(result.arr?.toNumber()).toBe(900_000);
  });

  it("returns NO_RECOGNIZED_NIGHTS with null ARR when only COMP exists", async () => {
    const user = await createUser();
    const roomType = await createRoomType({ baseRate: 900_000 });
    const guest = await createGuest();
    const { reservation, nights } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-01-05",
      nightlyRates: [900_000],
      revenueClasses: [ReservationNightRevenueClass.COMP],
    });
    const folio = await createFolio(reservation.id);
    const roomCharge = await createArticle({
      code: "ROOM-CHARGE",
      type: ArticleType.ROOM,
      defaultPrice: 900_000,
    });
    await createFolioLine({
      folioId: folio.id,
      articleId: roomCharge.id,
      postedById: user.id,
      reservationNightId: nights[0].id,
      amount: 900_000,
    });

    const result = await computeArr({
      fromInclusive: parseISODateOnly("2026-01-05"),
      toExclusive: parseISODateOnly("2026-01-06"),
      resolvedCutover: {
        ok: true,
        date: parseISODateOnly("2026-01-01"),
        source: "CONFIG",
      },
    });

    expect(result.status).toBe("NO_RECOGNIZED_NIGHTS");
    expect(result.numerator.toNumber()).toBe(0);
    expect(result.paidRoomNights).toBe(0);
    expect(result.arr).toBeNull();
  });
});
