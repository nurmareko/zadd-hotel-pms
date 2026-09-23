import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  roomType: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  roomBlock: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getTapeChartData } from "./tape-chart-data";

const block = {
  id: 1, roomId: 108, reason: "MAINTENANCE", status: "ACTIVE",
  startDate: new Date("2026-09-14T00:00:00Z"),
  endDate: new Date("2026-09-17T00:00:00Z"),
  note: "Perbaikan pipa AC.",
};

beforeEach(() => {
  vi.useFakeTimers();
  // Already September 14 in WIB, but still September 13 in UTC.
  vi.setSystemTime(new Date("2026-09-13T18:00:00Z"));
  vi.resetAllMocks();
  db.roomType.findMany.mockResolvedValue([{
    id: 1, code: "STD", name: "Standar", rooms: [
      { id: 108, number: "108", floor: 1, status: "OOO" },
      { id: 109, number: "109", floor: 1, status: "VC" },
    ],
  }]);
  db.reservation.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("tape chart room blocks", () => {
  it("loads active blocks intersecting the full half-open 14-day window and maps notes by room", async () => {
    db.roomBlock.findMany.mockResolvedValueOnce([block]).mockResolvedValueOnce([{ roomId: 108 }]);
    const data = await getTapeChartData(new Date(2026, 8, 14), 14);

    expect(db.roomBlock.findMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      startDate: { lt: new Date("2026-09-28T00:00:00Z") },
      endDate: { gt: new Date("2026-09-14T00:00:00Z") },
    });
    expect(data.startDate).toBe("2026-09-14");
    expect(data.endDate).toBe("2026-09-28");
    expect(data.roomTypes[0].rooms[0].roomBlocks).toEqual([{
      ...block, startDate: "2026-09-14", endDate: "2026-09-17",
    }]);
    expect(data.roomTypes[0].rooms[1].roomBlocks).toEqual([]);
  });

  it("counts each blocked room today once even with a shifted window and multiple blocks", async () => {
    db.roomBlock.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { roomId: 109 }, { roomId: 109 },
    ]);
    const data = await getTapeChartData(new Date(2026, 9, 1), 14);

    expect(db.roomBlock.findMany.mock.calls[1][0]).toEqual({
      where: {
        status: "ACTIVE",
        startDate: { lt: new Date("2026-09-15T00:00:00Z") },
        endDate: { gt: new Date("2026-09-14T00:00:00Z") },
      },
      select: { roomId: true }, distinct: ["roomId"],
    });
    const rooms = data.roomTypes[0].rooms;
    expect(rooms.filter((room) => room.isBlockedToday)).toHaveLength(1);
    expect(rooms[1]).toMatchObject({ status: "VC", isBlockedToday: true, roomBlocks: [] });
    // Physical OOO remains separate from today's dated-block signal.
    expect(rooms[0]).toMatchObject({ status: "OOO", isBlockedToday: false, roomBlocks: [] });
  });

  it.each([{ blockedRooms: [] }, { blockedRooms: [{ roomId: 108 }] }])("preserves physical OOO independently of today's blocks $blockedRooms", async ({ blockedRooms }) => {
    db.roomBlock.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(blockedRooms);
    const data = await getTapeChartData(new Date(2026, 9, 1), 14);
    expect(data.roomTypes[0].rooms).toMatchObject([
      { id: 108, status: "OOO", isBlockedToday: blockedRooms.length > 0, roomBlocks: [] },
      { id: 109, status: "VC", isBlockedToday: false, roomBlocks: [] },
    ]);
  });

  it("retains allocated and unallocated reservations alongside blocks", async () => {
    db.roomBlock.findMany.mockResolvedValueOnce([block]).mockResolvedValueOnce([]);
    const reservation = {
      id: 10, groupBookingId: null, roomTypeId: 1, roomId: 108,
      arrivalDate: new Date("2026-09-18T00:00:00Z"),
      departureDate: new Date("2026-09-20T00:00:00Z"),
      status: "CONFIRMED", guest: { fullName: "Tamu Uji" },
    };
    db.reservation.findMany.mockResolvedValue([reservation, { ...reservation, id: 11, roomId: null }]);
    const data = await getTapeChartData(new Date(2026, 8, 14), 14);
    expect(data.roomTypes[0].rooms[0].reservations[0].id).toBe(10);
    expect(data.roomTypes[0].unallocatedReservations[0].id).toBe(11);
  });
});
