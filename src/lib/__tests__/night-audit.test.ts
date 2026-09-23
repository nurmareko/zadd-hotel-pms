import { ArrangementType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAuditStayChargeLines,
  classifyNightAuditRevenues,
  MAX_AUDIT_ATTEMPTS,
  type NightAuditStayChargeReservation,
} from "@/lib/night-audit";
import { ROOM_CHARGE_ARTICLE_CODE, type StayChargeArticle } from "@/lib/stay-charges";

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("classifyNightAuditRevenues", () => {
  it.each([
    { code: "ROOM-CHARGE", type: "ROOM" as const, bucket: "roomRevenue" as const },
    { code: "ROOM-CUSTOM", type: "ROOM" as const, bucket: "roomRevenue" as const },
    { code: "MEAL-BB", type: "FB" as const, bucket: "inclusionRevenue" as const },
    { code: "LAUNDRY", type: "MISC" as const, bucket: "otherRevenue" as const },
  ])("classifies daytime $code as $bucket", ({ code, type, bucket }) => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [{ amount: decimal("123.45"), article: { code, type } }],
      closedFbRevenueTotal: null,
      roomArticleId: 1,
    });

    expect(revenue[bucket].toString()).toBe("123.45");
    expect(revenue.fbRevenue.toString()).toBe(type === "FB" ? "123.45" : "0");
    expect(revenue.totalRevenue.toString()).toBe("123.45");
  });

  it("combines shortfalls, daytime charges, and closed F&B orders exactly once", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [
        { articleId: 1, amount: decimal(500_000) },
        { articleId: 2, amount: decimal(100_000) },
      ],
      existingDaytimeFolioLines: [
        { amount: decimal(400_000), article: { code: "ROOM-CHARGE", type: "ROOM" } },
        { amount: decimal(50_000), article: { code: "MEAL-BB", type: "FB" } },
        { amount: decimal(25_000), article: { code: "LAUNDRY", type: "MISC" } },
      ],
      closedFbRevenueTotal: "75000",
      roomArticleId: 1,
    });

    expect(revenue.roomRevenue.toString()).toBe("900000");
    expect(revenue.inclusionRevenue.toString()).toBe("150000");
    expect(revenue.closedFbOrderRevenue.toString()).toBe("75000");
    expect(revenue.fbRevenue.toString()).toBe("225000");
    expect(revenue.otherRevenue.toString()).toBe("25000");
    expect(revenue.totalRevenue.toString()).toBe("1150000");
    expect(revenue.totalRevenue.equals(
      revenue.roomRevenue.plus(revenue.fbRevenue).plus(revenue.otherRevenue),
    )).toBe(true);
  });

  it("gives ROOM-CHARGE code precedence over FB type without double counting", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [
        { amount: decimal(100), article: { code: "ROOM-CHARGE", type: "FB" } },
      ],
      closedFbRevenueTotal: null,
      roomArticleId: 1,
    });
    expect(revenue.roomRevenue.toString()).toBe("100");
    expect(revenue.inclusionRevenue.toString()).toBe("0");
    expect(revenue.fbRevenue.toString()).toBe("0");
    expect(revenue.totalRevenue.toString()).toBe("100");
  });

  it("returns zero revenue when there are no charges or room article", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [],
      closedFbRevenueTotal: undefined,
      roomArticleId: undefined,
    });
    expect(Object.values(revenue).every((value) => value.isZero())).toBe(true);
  });
});

describe("night audit domain logic", () => {
  it("exports MAX_AUDIT_ATTEMPTS = 3", () => {
    expect(MAX_AUDIT_ATTEMPTS).toBe(3);
  });

  it("buildAuditStayChargeLines generates shortfall lines for room and inclusions", () => {
    const articles: StayChargeArticle[] = [
      {
        id: 1,
        code: ROOM_CHARGE_ARTICLE_CODE,
        name: "Room Charge",
        type: "ROOM",
        defaultPrice: decimal(500_000),
      },
      {
        id: 2,
        code: "MEAL-BB",
        name: "Breakfast",
        type: "FB",
        defaultPrice: decimal(50_000),
      },
    ];

    const reservation: NightAuditStayChargeReservation = {
      reservationId: 101,
      reservationNo: "RSV-101",
      folioId: 201,
      arrivalDate: date("2026-08-05"),
      departureDate: date("2026-08-07"),
      reservationNights: [
        {
          id: "night-1",
          reservationId: 101,
          date: date("2026-08-05"),
          rateAmount: decimal(500_000),
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: decimal(50_000),
          mealAmount: decimal(100_000),
        },
        {
          id: "night-2",
          reservationId: 101,
          date: date("2026-08-06"),
          rateAmount: decimal(500_000),
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: decimal(50_000),
          mealAmount: decimal(100_000),
        },
      ],
    };

    // When running audit on business date 2026-08-05, only night-1 should be posted
    const lines = buildAuditStayChargeLines({
      reservation,
      existingLineItems: [],
      articles,
      businessDate: date("2026-08-05"),
      postedById: 1,
      postedAt: date("2026-08-05"),
      label: "2026-08-05",
    });

    expect(lines).toHaveLength(2); // 1 room charge + 1 breakfast inclusion
    const roomLine = lines.find((l) => l.articleId === 1);
    const mealLine = lines.find((l) => l.articleId === 2);

    expect(roomLine).toBeDefined();
    expect(roomLine?.amount.toString()).toBe("500000");
    expect(roomLine?.reservationNightId).toBe("night-1");
    expect(roomLine?.description).toBe("Night Audit Room Charge - 2026-08-05");

    expect(mealLine).toBeDefined();
    expect(mealLine?.amount.toString()).toBe("100000");
    expect(mealLine?.reservationNightId).toBe("night-1");
    expect(mealLine?.description).toBe("Night Audit Breakfast Inclusion - 2026-08-05");
  });

  it("buildAuditStayChargeLines returns empty array if night was already posted", () => {
    const articles: StayChargeArticle[] = [
      {
        id: 1,
        code: ROOM_CHARGE_ARTICLE_CODE,
        name: "Room Charge",
        type: "ROOM",
        defaultPrice: decimal(500_000),
      },
    ];

    const reservation: NightAuditStayChargeReservation = {
      reservationId: 101,
      reservationNo: "RSV-101",
      folioId: 201,
      arrivalDate: date("2026-08-05"),
      departureDate: date("2026-08-06"),
      reservationNights: [
        {
          id: "night-1",
          reservationId: 101,
          date: date("2026-08-05"),
          rateAmount: decimal(500_000),
          mealPlan: null,
          mealPax: null,
          mealUnitPrice: null,
          mealAmount: null,
        },
      ],
    };

    // Already posted by checkout catch-up
    const existingLineItems = [
      {
        articleId: 1,
        fbOrderId: null,
        reservationNightId: "night-1",
      },
    ];

    const lines = buildAuditStayChargeLines({
      reservation,
      existingLineItems,
      articles,
      businessDate: date("2026-08-05"),
      postedById: 1,
      postedAt: date("2026-08-05"),
      label: "2026-08-05",
    });

    expect(lines).toHaveLength(0);
  });
});
