import { describe, expect, it } from "vitest";

import {
  calculateOccupancy,
  summarizeInHouse,
  summarizeRoomStatuses,
} from "./fo-dashboard";

describe("calculateOccupancy", () => {
  it.each([
    { total: 0, occupied: 0, ooo: 0, sellable: 0, rate: 0 },
    { total: 10, occupied: 0, ooo: 0, sellable: 10, rate: 0 },
    { total: 10, occupied: 5, ooo: 0, sellable: 10, rate: 50 },
    { total: 10, occupied: 4, ooo: 2, sellable: 8, rate: 50 },
    { total: 10, occupied: 8, ooo: 2, sellable: 8, rate: 100 },
    { total: 10, occupied: 0, ooo: 10, sellable: 0, rate: 0 },
    { total: 10, occupied: 1, ooo: 10, sellable: 0, rate: 0 },
  ])(
    "returns $rate% and $sellable sellable rooms for total=$total, occupied=$occupied, OOO=$ooo",
    ({ total, occupied, ooo, sellable, rate }) => {
      expect(calculateOccupancy(total, occupied, ooo)).toEqual({
        occupancyRate: rate,
        sellableRooms: sellable,
      });
    },
  );

  it("preserves fractional percentages instead of rounding", () => {
    const result = calculateOccupancy(4, 1, 1);

    expect(result.sellableRooms).toBe(3);
    expect(result.occupancyRate).toBeCloseTo(100 / 3, 10);
  });
});

describe("summarizeRoomStatuses", () => {
  it("returns zero for every bucket when empty", () => {
    expect(summarizeRoomStatuses([])).toEqual({
      clean: 0, dirty: 0, inspected: 0, ooo: 0, occupied: 0,
    });
  });

  it.each([
    { status: "VC", clean: 1, dirty: 0, inspected: 0, ooo: 0, occupied: 0 },
    { status: "VD", clean: 0, dirty: 1, inspected: 0, ooo: 0, occupied: 0 },
    { status: "VCU", clean: 0, dirty: 0, inspected: 1, ooo: 0, occupied: 0 },
    { status: "OOO", clean: 0, dirty: 0, inspected: 0, ooo: 1, occupied: 0 },
    { status: "OC", clean: 0, dirty: 0, inspected: 0, ooo: 0, occupied: 1 },
    { status: "OD", clean: 0, dirty: 0, inspected: 0, ooo: 0, occupied: 1 },

  ] as const)("maps $status only to its designated bucket", ({ status, ...expected }) => {
    expect(summarizeRoomStatuses([{ status }])).toEqual(expected);
  });

  it("counts repeated mixed statuses", () => {
    expect(summarizeRoomStatuses([
      { status: "VC" }, { status: "VC" }, { status: "VD" },
      { status: "VCU" }, { status: "VCU" }, { status: "OOO" },
      { status: "OC" }, { status: "OD" }, { status: "OD" },

    ])).toEqual({ clean: 2, dirty: 1, inspected: 2, ooo: 1, occupied: 3 });
  });

  it("counts all-OOO rooms without adding to other buckets", () => {
    expect(summarizeRoomStatuses([{ status: "OOO" }, { status: "OOO" }]))
      .toEqual({ clean: 0, dirty: 0, inspected: 0, ooo: 2, occupied: 0 });
  });

  it("accepts frozen input without mutating it and returns independent summaries", () => {
    const rooms = Object.freeze([Object.freeze({ status: "VC" as const })]);
    const first = summarizeRoomStatuses(rooms);
    first.clean = 99;

    expect(summarizeRoomStatuses(rooms)).toEqual({
      clean: 1, dirty: 0, inspected: 0, ooo: 0, occupied: 0,
    });
    expect(rooms).toEqual([{ status: "VC" }]);
  });
});

describe("summarizeInHouse", () => {
  it("returns zero rooms and guests for no reservations", () => {
    expect(summarizeInHouse([])).toEqual({ roomCount: 0, guestCount: 0 });
  });

  it("sums adults and children across reservations", () => {
    expect(summarizeInHouse([
      { adults: 2, children: 1 },
      { adults: 1, children: 0 },
      { adults: 2, children: 3 },
    ])).toEqual({ roomCount: 3, guestCount: 9 });
  });

  it("counts each reservation as a room even with zero guests", () => {
    expect(summarizeInHouse([
      { adults: 0, children: 0 }, { adults: 0, children: 0 },
    ])).toEqual({ roomCount: 2, guestCount: 0 });
  });

  it("includes children when there are no adults", () => {
    expect(summarizeInHouse([{ adults: 0, children: 2 }]))
      .toEqual({ roomCount: 1, guestCount: 2 });
  });

  it("does not deduplicate reservations or mutate frozen input", () => {
    const reservation = Object.freeze({ adults: 2, children: 1 });
    const reservations = Object.freeze([reservation, reservation]);

    expect(summarizeInHouse(reservations)).toEqual({ roomCount: 2, guestCount: 6 });
    expect(reservations).toEqual([
      { adults: 2, children: 1 }, { adults: 2, children: 1 },
    ]);
  });
});
