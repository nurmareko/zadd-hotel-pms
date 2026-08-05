import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { flatReservationNightSummaryTotal } from "@/lib/flat-reservation-night-total";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("flatReservationNightSummaryTotal", () => {
  const input = {
    arrivalDate: date("2026-08-01"),
    departureDate: date("2026-08-03"),
    rateAmount: new Prisma.Decimal(550_000),
  };

  it("uses a complete equivalent nightly summary", () => {
    const total = flatReservationNightSummaryTotal({
      ...input,
      summary: {
        count: 2,
        total: new Prisma.Decimal(1_155_000),
        firstDate: date("2026-08-01"),
        lastDate: date("2026-08-02"),
      },
    });

    expect(total.toNumber()).toBe(1_155_000);
  });

  it("uses the scalar fallback when the summary endpoints are incomplete", () => {
    const total = flatReservationNightSummaryTotal({
      ...input,
      summary: {
        count: 2,
        total: new Prisma.Decimal(1_155_000),
        firstDate: date("2026-08-01"),
        lastDate: date("2026-08-03"),
      },
    });

    expect(total.toNumber()).toBe(1_100_000);
  });
});
