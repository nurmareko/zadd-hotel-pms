import { ArrangementType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAuditStayChargeLines,
  MAX_AUDIT_ATTEMPTS,
  type NightAuditStayChargeReservation,
} from "@/lib/night-audit";
import { ROOM_CHARGE_ARTICLE_CODE, type StayChargeArticle } from "@/lib/stay-charges";

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

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
