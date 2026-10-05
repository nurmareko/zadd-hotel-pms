import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  stayChargeShortfallLines,
  stayNightsThroughAuditDate,
  stayNightsThroughCheckout,
  type StayChargeArticle,
  type StayChargeReservationNight,
} from "@/lib/stay-charges";

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("stay charge night counts", () => {
  it("counts stayed nights through checkout with the departure day excluded", () => {
    expect(
      stayNightsThroughCheckout(
        date("2026-08-01"),
        new Date("2026-08-03T01:00:00.000Z"),
      ),
    ).toBe(2);
  });

  it("counts the audit business date as a recognized night", () => {
    expect(
      stayNightsThroughAuditDate(date("2026-08-01"), date("2026-08-02")),
    ).toBe(2);
  });

  it.each([
    ["2026-09-18", "2026-09-22", 4],
    ["2026-09-17", "2026-09-21", 4],
    ["2026-09-06", "2026-09-07", 1],
    ["2026-09-28", "2026-09-29", 1],
  ])(
    "uses [check-in, check-out) for %s to %s",
    (arrival, departure, expectedNights) => {
      expect(
        stayNightsThroughCheckout(
          date(arrival),
          new Date("2026-10-05T01:00:00.000Z"),
          date(departure),
        ),
      ).toBe(expectedNights);
      expect(
        stayNightsThroughAuditDate(
          date(arrival),
          date("2026-10-05"),
          date(departure),
        ),
      ).toBe(expectedNights);
    },
  );

  it("does not create a pending charge for the checkout date", () => {
    const nights = [18, 19, 20, 21].map((day) => ({
      id: `night-${day}`,
      reservationId: 1,
      date: date(`2026-09-${day}`),
      rateAmount: decimal(1_250_000),
      mealPlan: null,
      mealPax: null,
      mealUnitPrice: null,
      mealAmount: null,
    }));

    const article = {
      id: 1,
      code: "ROOM-CHARGE",
      name: "Room charge",
      type: "ROOM",
      defaultPrice: decimal(1_250_000),
    } as StayChargeArticle;

    const lines = stayChargeShortfallLines({
      reservationId: 1,
      reservationNo: "TEST-RESERVATION",
      arrivalDate: date("2026-09-18"),
      departureDate: date("2026-09-22"),
      expectedNights: 4,
      reservationNights: nights,
      lineItems: [],
      articles: [article],
    });

    expect(lines.map((line) => line.serviceDate.toISOString().slice(0, 10))).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
    ]);
  });
});

describe("stayChargeShortfallLines", () => {
  it("builds room and snapshotted meal lines from the verified nightly amounts", () => {
    const roomArticle = {
      id: 1,
      code: "ROOM-CHARGE",
      name: "Room charge",
      type: "ROOM",
      defaultPrice: decimal(550_000),
    } as StayChargeArticle;
    const mealArticle = {
      id: 2,
      code: "MEAL-BB",
      name: "Breakfast package",
      type: "FB",
      defaultPrice: decimal(50_000),
    } as StayChargeArticle;
    const reservationNight = {
      id: "night-1",
      reservationId: 10,
      date: date("2026-08-01"),
      rateAmount: decimal(550_000),
      mealPlan: "BB",
      mealPax: 2,
      mealUnitPrice: decimal(50_000),
      mealAmount: decimal(100_000),
    } as StayChargeReservationNight;

    const lines = stayChargeShortfallLines({
      reservationId: 10,
      reservationNo: "RSV-001",
      arrivalDate: date("2026-08-01"),
      departureDate: date("2026-08-02"),
      expectedNights: 1,
      reservationNights: [reservationNight],
      lineItems: [],
      articles: [roomArticle, mealArticle],
    });
    const roomLine = lines.find((line) => line.article.code === "ROOM-CHARGE");
    const mealLine = lines.find((line) => line.article.code === "MEAL-BB");

    expect(roomLine?.quantity.toNumber()).toBe(1);
    expect(roomLine?.unitPrice.toNumber()).toBe(550_000);
    expect(roomLine?.amount.toNumber()).toBe(550_000);
    expect(mealLine?.quantity.toNumber()).toBe(2);
    expect(mealLine?.unitPrice.toNumber()).toBe(50_000);
    expect(mealLine?.amount.toNumber()).toBe(100_000);
  });

  it("posts an earlier missing room night when a later night is already linked", () => {
    const roomArticle = {
      id: 1,
      code: "ROOM-CHARGE",
      name: "Room charge",
      type: "ROOM",
      defaultPrice: null,
    } as StayChargeArticle;
    const nights = [
      {
        id: "night-1",
        reservationId: 10,
        date: date("2026-08-01"),
        rateAmount: decimal(550_000),
        mealPlan: null,
        mealPax: null,
        mealUnitPrice: null,
        mealAmount: null,
      },
      {
        id: "night-2",
        reservationId: 10,
        date: date("2026-08-02"),
        rateAmount: decimal(650_000),
        mealPlan: null,
        mealPax: null,
        mealUnitPrice: null,
        mealAmount: null,
      },
    ] as StayChargeReservationNight[];

    const lines = stayChargeShortfallLines({
      reservationId: 10,
      reservationNo: "RSV-002",
      arrivalDate: date("2026-08-01"),
      departureDate: date("2026-08-03"),
      expectedNights: 2,
      reservationNights: nights,
      lineItems: [
        {
          articleId: roomArticle.id,
          fbOrderId: null,
          reservationNightId: nights[1]!.id,
        },
      ],
      articles: [roomArticle],
    });

    expect(lines.map((line) => line.reservationNightId)).toEqual(["night-1"]);
    expect(lines[0]?.amount.toNumber()).toBe(550_000);
  });

  it("does not treat unlinked or F&B-origin lines as posted stay charges", () => {
    const roomArticle = {
      id: 1,
      code: "ROOM-CHARGE",
      name: "Room charge",
      type: "ROOM",
      defaultPrice: null,
    } as StayChargeArticle;
    const mealArticle = {
      id: 2,
      code: "MEAL-BB",
      name: "Breakfast package",
      type: "FB",
      defaultPrice: decimal(50_000),
    } as StayChargeArticle;
    const night = {
      id: "night-1",
      reservationId: 10,
      date: date("2026-08-01"),
      rateAmount: decimal(550_000),
      mealPlan: "BB",
      mealPax: 2,
      mealUnitPrice: decimal(50_000),
      mealAmount: decimal(100_000),
    } as StayChargeReservationNight;

    const lines = stayChargeShortfallLines({
      reservationId: 10,
      reservationNo: "RSV-003",
      arrivalDate: date("2026-08-01"),
      departureDate: date("2026-08-02"),
      expectedNights: 1,
      reservationNights: [night],
      lineItems: [
        {
          articleId: roomArticle.id,
          fbOrderId: null,
          reservationNightId: null,
        },
        {
          articleId: roomArticle.id,
          fbOrderId: 20,
          reservationNightId: night.id,
        },
        {
          articleId: mealArticle.id,
          fbOrderId: 21,
          reservationNightId: night.id,
        },
      ],
      articles: [roomArticle, mealArticle],
    });

    expect(lines.map((line) => line.article.code)).toEqual([
      "ROOM-CHARGE",
      "MEAL-BB",
    ]);
  });
});
