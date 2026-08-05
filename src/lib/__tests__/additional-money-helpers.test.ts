import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeFBOrderTotals } from "@/lib/fb-order-totals";
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
