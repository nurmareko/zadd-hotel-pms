import { describe, expect, it } from "vitest";
import { CreateRoomBlockSchema, ReleaseRoomBlockSchema } from "./schema";
const valid = { roomId: "10", startDate: "2026-09-14", endDate: "2026-09-17" };
describe("room block boundary validation", () => {
  it("parses form IDs and defaults the reason", () => {
    expect(CreateRoomBlockSchema.parse(valid)).toEqual({ ...valid, roomId: 10, reason: "MAINTENANCE" });
  });
  it.each([
    { startDate: "2026-02-30" }, { startDate: "not-a-date" },
    { endDate: "2026-09-14" }, { endDate: "2026-09-13" },
    { roomId: "0" }, { roomId: "1.5" }, { reason: "UNKNOWN" },
    { note: "a".repeat(2001) },
  ])("rejects invalid input %j", (override) => {
    expect(CreateRoomBlockSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
  it("accepts real leap days and rejects impossible ones", () => {
    expect(CreateRoomBlockSchema.safeParse({ ...valid, startDate: "2028-02-29", endDate: "2028-03-01" }).success).toBe(true);
    expect(CreateRoomBlockSchema.safeParse({ ...valid, startDate: "2027-02-29" }).success).toBe(false);
  });
  it("requires a positive block ID on release", () => {
    expect(ReleaseRoomBlockSchema.parse({ blockId: "5" })).toEqual({ blockId: 5 });
    expect(ReleaseRoomBlockSchema.safeParse({ blockId: -1 }).success).toBe(false);
  });
});
