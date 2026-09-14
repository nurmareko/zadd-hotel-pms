import { describe, expect, it } from "vitest";
import { computeDailyRoomTypeCapacity } from "./reservation-capacity-logic";

const range = { startDate: "2026-09-14", endDate: "2026-09-17" };
const block = { ...range, roomId: 10, status: "ACTIVE" as const };
const reservation = { arrivalDate: "2026-09-14", departureDate: "2026-09-16" };

describe("dated room-type capacity", () => {
  it("subtracts distinct blocked rooms, not block rows, on each night", () => {
    const days = computeDailyRoomTypeCapacity({ range, roomCount: 3, reservations: [reservation], blocks: [block, block, { ...block, roomId: 11, startDate: "2026-09-15", endDate: "2026-09-16" }] });
    expect(days.map(({ available, blockedCount }) => [available, blockedCount])).toEqual([[1, 1], [0, 2], [2, 1]]);
  });
  it("ignores released and nonoverlapping blocks and permits boundary arrivals", () => {
    const days = computeDailyRoomTypeCapacity({ range, roomCount: 2, reservations: [], blocks: [{ ...block, status: "RELEASED" }, { ...block, endDate: range.startDate }, { ...block, startDate: range.endDate, endDate: "2026-09-20" }] });
    expect(days.map((day) => day.available)).toEqual([2, 2, 2]);
  });
  it("counts unallocated reservations and exposes negative capacity", () => {
    const days = computeDailyRoomTypeCapacity({ range, roomCount: 1, reservations: [reservation], blocks: [block] });
    expect(days[0]).toMatchObject({ available: -1, reservationCount: 1, blockedCount: 1 });
  });
  it("uses UTC-safe calendar days across month and year boundaries", () => {
    expect(computeDailyRoomTypeCapacity({ range: { startDate: "2026-12-31", endDate: "2027-01-02" }, roomCount: 1, reservations: [], blocks: [] }).map((day) => day.date)).toEqual(["2026-12-31", "2027-01-01"]);
  });
});
