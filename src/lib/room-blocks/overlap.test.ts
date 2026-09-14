import { describe, expect, it } from "vitest";
import { overlapsDateRange, findOverlappingRoomBlock } from "./overlap";

const range = { startDate: "2026-09-14", endDate: "2026-09-17" };
const block = { ...range, id: 1, roomId: 10, reason: "MAINTENANCE" as const, status: "ACTIVE" as const };

describe("half-open hotel date ranges", () => {
  it.each([
    ["2026-09-13", "2026-09-14", false],
    ["2026-09-17", "2026-09-18", false],
    ["2026-09-14", "2026-09-15", true],
    ["2026-09-16", "2026-09-18", true],
    ["2026-09-13", "2026-09-18", true],
    ["2026-09-15", "2026-09-15", false],
    ["2026-09-17", "2026-09-14", false],
  ])("%s to %s overlaps: %s", (startDate, endDate, expected) => {
    expect(overlapsDateRange(range, { startDate, endDate })).toBe(expected);
  });
  it("ignores released blocks and other rooms", () => {
    expect(findOverlappingRoomBlock([{ ...block, status: "RELEASED" }, { ...block, roomId: 11 }], 10, range)).toBeUndefined();
    expect(findOverlappingRoomBlock([block], 10, range)).toEqual(block);
  });
});
