import { describe, expect, it, vi } from "vitest";
import { activeRoomBlockWhere, detectRoomBlockReservationConflicts } from "./queries";
const range = { startDate: "2026-09-14", endDate: "2026-09-17" };
describe("room block query contracts", () => {
  it("filters active blocks by strict half-open DATE overlap", () => {
    expect(activeRoomBlockWhere({ roomId: 10, roomTypeId: 2, range })).toEqual({
      roomId: 10, room: { roomTypeId: 2 }, status: "ACTIVE",
      startDate: { lt: new Date("2026-09-17T00:00:00Z") },
      endDate: { gt: new Date("2026-09-14T00:00:00Z") },
    });
  });
  it("detects only confirmed and checked-in reservations with half-open overlap", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { reservation: { findMany } } as unknown as Parameters<typeof detectRoomBlockReservationConflicts>[1];
    await detectRoomBlockReservationConflicts({ roomId: 10, range }, db);
    expect(findMany.mock.calls[0][0].where).toEqual({ roomId: 10, status: { in: ["CONFIRMED", "CHECKED_IN"] }, arrivalDate: { lt: new Date("2026-09-17") }, departureDate: { gt: new Date("2026-09-14") } });
  });
});
