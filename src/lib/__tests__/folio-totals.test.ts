import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeFolioTotals } from "@/lib/folio-totals";

type LineItem = Parameters<typeof computeFolioTotals>[0][number];
type Payment = Parameters<typeof computeFolioTotals>[1][number];
type Settings = Parameters<typeof computeFolioTotals>[2];

function line(
  amount: Prisma.Decimal.Value,
  type = "ROOM",
  fbOrderId: number | null = null,
): LineItem {
  return {
    amount: new Prisma.Decimal(amount),
    fbOrderId,
    article: { type },
  } as unknown as LineItem;
}

function payment(
  amount: Prisma.Decimal.Value,
  purpose: "DEPOSIT" | "PAYMENT" | "SETTLEMENT" = "PAYMENT",
): Payment {
  return {
    amount: new Prisma.Decimal(amount),
    purpose,
  } as unknown as Payment;
}

function settings(serviceChargePercent = 5, taxPercent = 10): Settings {
  return {
    serviceChargePercent: new Prisma.Decimal(serviceChargePercent),
    taxPercent: new Prisma.Decimal(taxPercent),
  } as unknown as Settings;
}

describe("computeFolioTotals", () => {
  it("calculates room and meal charges using tax on subtotal plus service", () => {
    const totals = computeFolioTotals(
      [line(550_000), line(100_000, "FB")],
      [],
      settings(),
    );

    expect(totals).toEqual({
      subtotal: 650_000,
      serviceCharge: 32_500,
      tax: 68_250,
      taxableExtras: 0,
      totalCharges: 750_750,
      totalPaid: 0,
      balance: 750_750,
    });
  });

  it.each([
    [2_000_000, 100_000, 210_000, 2_310_000],
    [2_100_000, 105_000, 220_500, 2_425_500],
  ])(
    "calculates the verified totals for subtotal %i",
    (subtotal, serviceCharge, tax, totalCharges) => {
      expect(computeFolioTotals([line(subtotal)], [], settings())).toMatchObject({
        subtotal,
        serviceCharge,
        tax,
        totalCharges,
      });
    },
  );

  it("calculates the verified meal plus fee total", () => {
    expect(
      computeFolioTotals(
        [line(450_000, "FB"), line(100_000, "MISC")],
        [],
        settings(),
      ),
    ).toMatchObject({
      subtotal: 550_000,
      serviceCharge: 27_500,
      tax: 57_750,
      totalCharges: 635_250,
    });
  });

  it("includes linked gross F&B charges without taxing them again", () => {
    expect(
      computeFolioTotals(
        [line(100_000), line(115_500, "FB", 42)],
        [],
        settings(),
      ),
    ).toEqual({
      subtotal: 100_000,
      serviceCharge: 5_000,
      tax: 10_500,
      taxableExtras: 0,
      totalCharges: 231_000,
      totalPaid: 0,
      balance: 231_000,
    });
  });

  it("taxes synthetic pending charges that omit F&B linkage", () => {
    const pendingLine = {
      amount: new Prisma.Decimal(10),
      article: { type: "ROOM" },
    } as unknown as LineItem;

    expect(computeFolioTotals([pendingLine], [], settings())).toMatchObject({
      subtotal: 10,
      serviceCharge: 1,
      tax: 1,
      totalCharges: 12,
    });
  });

  it("subtracts multiple payments exactly once", () => {
    const totals = computeFolioTotals(
      [line(3_550_000)],
      [payment(850_000), payment(100_000), payment(3_150_250)],
      settings(),
    );

    expect(totals.totalCharges).toBe(4_100_250);
    expect(totals.totalPaid).toBe(4_100_250);
    expect(totals.balance).toBe(0);
  });

  it("treats payment purposes identically in folio arithmetic", () => {
    const lineItems = [line(1_000_000)];
    const amount = 100_000;

    const deposit = computeFolioTotals(
      lineItems,
      [payment(amount, "DEPOSIT")],
      settings(),
    );
    const ordinary = computeFolioTotals(
      lineItems,
      [payment(amount, "PAYMENT")],
      settings(),
    );
    const settlement = computeFolioTotals(
      lineItems,
      [payment(amount, "SETTLEMENT")],
      settings(),
    );

    expect(deposit).toEqual(ordinary);
    expect(settlement).toEqual(ordinary);
  });

  it("excludes TAX and SERVICE lines from the percentage base and adds them afterward", () => {
    expect(
      computeFolioTotals(
        [line(1_000), line(100, "TAX"), line(50, "SERVICE")],
        [],
        settings(),
      ),
    ).toEqual({
      subtotal: 1_000,
      serviceCharge: 50,
      tax: 105,
      taxableExtras: 150,
      totalCharges: 1_305,
      totalPaid: 0,
      balance: 1_305,
    });
  });

  it("rounds half rupiah upward and returns whole-IDR outputs", () => {
    const totals = computeFolioTotals([line(10)], [], settings(5, 10));

    expect(totals).toMatchObject({
      subtotal: 10,
      serviceCharge: 1,
      tax: 1,
      totalCharges: 12,
    });
    expect(Object.values(totals).every(Number.isInteger)).toBe(true);
  });

  it.each([
    [50, "positive"],
    [0, "zero"],
    [-50, "negative"],
  ])("preserves a %s balance", (expectedBalance) => {
    const paid = 100 - expectedBalance;
    const totals = computeFolioTotals(
      [line(100)],
      [payment(paid)],
      settings(0, 0),
    );

    expect(totals.balance).toBe(expectedBalance);
  });

  it("returns all zeros for an empty folio", () => {
    expect(computeFolioTotals([], [], settings())).toEqual({
      subtotal: 0,
      serviceCharge: 0,
      tax: 0,
      taxableExtras: 0,
      totalCharges: 0,
      totalPaid: 0,
      balance: 0,
    });
  });
});
