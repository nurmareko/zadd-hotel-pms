import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { roundIDRPercentage } from "@/lib/whole-idr";
import {
  billBalanceAmountLabel,
  billBalanceLabel,
  folioBalanceState,
} from "@/lib/folio-balance-display";
import {
  hasLegacyNightlyRoomChargeShape,
  linkedRoomChargeIntegrityIssues,
  linkedRoomChargeShapeIssues,
} from "@/lib/room-charge-integrity";

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("computeFBOrderTotals", () => {
  it("calculates service and tax on an F&B order", () => {
    const totals = computeFBOrderTotals(
      [{ amount: 450_000 }, { amount: 100_000 }],
      { serviceChargePercent: decimal(5), taxPercent: decimal(10) },
    );

    expect(totals.subtotal.toNumber()).toBe(550_000);
    expect(totals.serviceCharge.toNumber()).toBe(27_500);
    expect(totals.tax.toNumber()).toBe(57_750);
    expect(totals.total.toNumber()).toBe(635_250);
  });

  it.each([
    [10, 10, 1, 1, 12],
    [25_001, 25_001, 1_250, 2_625, 28_876],
    [10.5, 11, 1, 1, 13],
  ])(
    "rounds subtotal %s and every percentage component to whole IDR",
    (amount, subtotal, serviceCharge, tax, total) => {
      const totals = computeFBOrderTotals(
        [{ amount }],
        { serviceChargePercent: decimal(5), taxPercent: decimal(10) },
      );

      expect(totals.subtotal.toNumber()).toBe(subtotal);
      expect(totals.serviceCharge.toNumber()).toBe(serviceCharge);
      expect(totals.tax.toNumber()).toBe(tax);
      expect(totals.total.toNumber()).toBe(total);
      expect(
        totals.total.equals(
          totals.subtotal.plus(totals.serviceCharge).plus(totals.tax),
        ),
      ).toBe(true);
      expect(
        Object.values(totals).every((value) => value.decimalPlaces() === 0),
      ).toBe(true);
    },
  );
});

describe("roundIDRPercentage", () => {
  it("matches canonical Decimal half-up rounding at floating-point boundaries", () => {
    const totals = computeFBOrderTotals(
      [{ amount: 50 }],
      { serviceChargePercent: decimal(29), taxPercent: decimal(10) },
    );

    expect(roundIDRPercentage(50, "29.00")).toBe(15);
    expect(totals.serviceCharge.toNumber()).toBe(15);
    expect(totals.tax.toNumber()).toBe(7);
    expect(totals.total.toNumber()).toBe(72);
  });
});

describe("folio balance display", () => {
  it.each([
    [100, "due", "Saldo Terutang", "Rp 100"],
    [0, "settled", "Saldo Lunas", "Rp 0"],
    [-100, "credit", "Kelebihan Pembayaran / Refund", "Rp 100"],
  ] as const)(
    "classifies and labels balance %i",
    (balance, state, label, amountLabel) => {
      expect(folioBalanceState(balance)).toBe(state);
      expect(billBalanceLabel(balance)).toBe(label);
      expect(billBalanceAmountLabel(balance)).toBe(amountLabel);
    },
  );
});

describe("room-charge integrity", () => {
  it("accepts a canonical linked room-charge shape", () => {
    expect(
      linkedRoomChargeIntegrityIssues({
        id: 1,
        fbOrderId: null,
        quantity: decimal(1),
        unitPrice: decimal(550_000),
        amount: decimal(550_000),
        folioReservationId: 10,
        reservationNightId: "night-1",
        reservationNightReservationId: 10,
        reservationNightRateAmount: decimal(550_000),
        serviceDate: date("2026-08-01"),
        reservationArrivalDate: date("2026-08-01"),
        reservationDepartureDate: date("2026-08-03"),
      }),
    ).toEqual([]);
  });

  it("reports malformed linked line amounts and quantities", () => {
    const issues = linkedRoomChargeShapeIssues({
      id: 2,
      fbOrderId: null,
      quantity: decimal(2),
      unitPrice: decimal(550_000),
      amount: decimal(1_100_000),
      reservationNightId: "night-2",
      reservationNightRateAmount: decimal(550_000),
      serviceDate: date("2026-08-01"),
    });

    expect(issues).toEqual([
      "line 2: quantity 2 is not 1",
      "line 2: amount 1100000 differs from unit price 550000",
    ]);
  });

  it("treats the departure boundary as outside the reservation stay", () => {
    const issues = linkedRoomChargeIntegrityIssues({
      id: 3,
      fbOrderId: null,
      quantity: decimal(1),
      unitPrice: decimal(550_000),
      amount: decimal(550_000),
      folioReservationId: 10,
      reservationNightId: "night-3",
      reservationNightReservationId: 10,
      reservationNightRateAmount: decimal(550_000),
      serviceDate: date("2026-08-03"),
      reservationArrivalDate: date("2026-08-01"),
      reservationDepartureDate: date("2026-08-03"),
    });

    expect(issues).toContain(
      "line 3: service date 2026-08-03 is outside reservation stay 2026-08-01–2026-08-03 (departure excluded)",
    );
  });

  it("recognizes only the documented legacy nightly room-charge shape", () => {
    const valid = {
      description: "Room charge",
      quantity: decimal(1),
      unitPrice: decimal(550_000),
      amount: decimal(550_000),
      reservationRateAmount: decimal(550_000),
    };

    expect(hasLegacyNightlyRoomChargeShape(valid)).toBe(true);
    expect(
      hasLegacyNightlyRoomChargeShape({
        ...valid,
        description: "Manual room adjustment",
      }),
    ).toBe(false);
  });
});
