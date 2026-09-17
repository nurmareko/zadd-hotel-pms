import type { RoomStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHousekeeperMobileData } from "../housekeeper-mobile-data";
import { isMobilePoolEligible, mobileServiceKind } from "../housekeeper-mobile-eligibility";

const db = vi.hoisted(() => ({
  room: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  housekeepingAssignment: { findMany: vi.fn() },
  cleaningSession: { findMany: vi.fn() },
  housekeepingLog: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const date = new Date("2026-09-17T00:00:00Z");
const yesterday = new Date("2026-09-16T00:00:00Z");
const tomorrow = new Date("2026-09-18T00:00:00Z");
const statuses: RoomStatus[] = ["VD", "OD", "VCU", "VC", "OC", "OOO"];
function room(id: number, status: RoomStatus = "VD", number = String(id)) {
  return { id, number, floor: 2, status, roomType: { code: "DLX", name: "Deluks" } };
}
function assignment(roomId: number, housekeeperId = 7) {
  return { roomId, housekeeper: { id: housekeeperId, fullName: "Sari" } };
}
function reservation(roomId: number, overrides = {}) {
  return {
    id: roomId, roomId, reservationNo: `RSV-${roomId}`, status: "CONFIRMED",
    arrivalDate: date, departureDate: tomorrow, notes: null,
    guest: { fullName: "Ani" }, stayFees: [], ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.room.findMany.mockResolvedValue([]);
  db.reservation.findMany.mockResolvedValue([]);
  db.housekeepingAssignment.findMany.mockResolvedValue([]);
  db.cleaningSession.findMany.mockResolvedValue([]);
  db.housekeepingLog.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("mobile eligibility and service kinds", () => {
  it.each(statuses)("applies status and movement eligibility for %s", (status) => {
    expect(isMobilePoolEligible({ status, hasScheduledMovement: false }))
      .toBe(["VD", "OD", "VCU"].includes(status));
    expect(isMobilePoolEligible({ status, hasScheduledMovement: true })).toBe(status !== "OOO");
  });

  it.each([
    ["VD", "turnover"], ["OD", "stayover"], ["VCU", "inspection"],
    ["VC", "routine"], ["OC", "routine"], ["OOO", "routine"],
  ] as const)("maps %s to %s", (status, kind) => {
    expect(mobileServiceKind(status)).toBe(kind);
  });
});

describe("getHousekeeperMobileData", () => {
  it("keeps every assigned status, separates other assignees and the eligible unassigned pool", async () => {
    db.room.findMany.mockResolvedValue([
      ...statuses.map((status, i) => room(i + 1, status)),
      room(20), room(21, "OD"), room(22, "VCU"), room(23, "VC"), room(24),
    ]);
    db.housekeepingAssignment.findMany.mockResolvedValue([
      ...statuses.map((_, i) => assignment(i + 1)), assignment(24, 8),
    ]);

    const result = await getHousekeeperMobileData(7, date);
    expect(result.date).toEqual(date);
    expect(result.myRooms.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.availablePoolRooms.map((item) => item.id)).toEqual([20, 21, 22]);
    expect(db.housekeepingAssignment.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ where: { date } }));
    expect(db.room.findMany).toHaveBeenCalledTimes(1);
    expect(db.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(result.myRooms[0]).toEqual({
      id: 1, number: "1", floor: 2, typeName: "Deluks", status: "VD",
      priority: "P5", taskCode: "TSK-1", serviceKind: "turnover", reservationContexts: [],
      notes: null, taskNote: null, startedAt: null, inProgress: false, activeHousekeeperId: null,
    });
  });

  it("reuses priorities, both turnover contexts, stayover context, reservation notes and task notes", async () => {
    db.room.findMany.mockResolvedValue([room(1), room(2, "OD"), room(3), room(4)]);
    db.housekeepingAssignment.findMany.mockResolvedValue([assignment(1), assignment(2), assignment(3), assignment(4)]);
    db.reservation.findMany.mockResolvedValue([
      reservation(1, { notes: "ETA 12:00; Bantal tambahan" }),
      reservation(1, { id: 11, reservationNo: "RSV-OLD", status: "CHECKED_OUT", arrivalDate: yesterday, departureDate: date }),
      reservation(2, { status: "CHECKED_IN", arrivalDate: yesterday, notes: "Jangan diganggu" }),
      reservation(3),
      reservation(3, { id: 13, status: "CHECKED_OUT", arrivalDate: yesterday, departureDate: date }),
      reservation(4, { status: "CHECKED_OUT", arrivalDate: yesterday, departureDate: date }),
    ]);
    db.housekeepingLog.findMany.mockResolvedValue([{ roomId: 1, note: "[TUGAS:TSK-1] Periksa kaca" }]);

    const { myRooms } = await getHousekeeperMobileData(7, date);
    expect(myRooms.map((item) => [item.id, item.priority])).toEqual([[1, "P1"], [3, "P2"], [4, "P3"], [2, "P4"]]);
    expect(myRooms[0]).toMatchObject({
      taskCode: "TSK-1", serviceKind: "turnover", notes: "ETA 12:00; Bantal tambahan",
      taskNote: "[TUGAS:TSK-1] Periksa kaca",
      reservationContexts: [
        { kind: "departure", reservationNo: "RSV-OLD", guestName: "Ani", nightsLabel: "1 malam", etaLabel: null },
        { kind: "arrival", reservationNo: "RSV-1", guestName: "Ani", nightsLabel: "1 malam", etaLabel: "12:00" },
      ],
    });
    expect(myRooms[3]).toMatchObject({
      serviceKind: "stayover", notes: "Jangan diganggu", taskNote: null,
      reservationContexts: [{ kind: "stayover", label: "Menginap", nightsLabel: "Malam 2/2" }],
    });
  });

  it("sorts both worklists by priority then natural room number, and the complete dropdown by number only", async () => {
    db.room.findMany.mockResolvedValue([
      room(1, "VD", "10"), room(2, "VD", "2"), room(3, "VD", "30"),
      room(4, "VD", "A10"), room(5, "VD", "A2"), room(6, "VD", "A30"),
      room(7, "OOO", "1"), room(8, "VC", "100"), room(9, "OC", "200"),
    ]);
    db.housekeepingAssignment.findMany.mockResolvedValue([assignment(1), assignment(2), assignment(3), assignment(9, 8)]);
    db.reservation.findMany.mockResolvedValue([reservation(3, { notes: "VIP" }), reservation(6, { notes: "VIP" })]);

    const result = await getHousekeeperMobileData(7, date);
    expect(result.myRooms.map((item) => item.number)).toEqual(["30", "2", "10"]);
    expect(result.availablePoolRooms.map((item) => item.number)).toEqual(["A30", "A2", "A10"]);
    expect(result.allHotelRooms).toEqual([
      { id: 7, number: "1" }, { id: 2, number: "2" }, { id: 1, number: "10" },
      { id: 3, number: "30" }, { id: 8, number: "100" }, { id: 9, number: "200" },
      { id: 5, number: "A2" }, { id: 4, number: "A10" }, { id: 6, number: "A30" },
    ]);
  });

  it("includes scheduled arrivals/departures but not stayover-only clean rooms or OOO movements", async () => {
    db.room.findMany.mockResolvedValue([room(1, "VC"), room(2, "OC"), room(3, "OC"), room(4, "OOO")]);
    db.reservation.findMany.mockResolvedValue([
      reservation(1),
      reservation(2, { status: "CHECKED_IN", arrivalDate: yesterday, departureDate: date }),
      reservation(3, { status: "CHECKED_IN", arrivalDate: yesterday }),
      reservation(4, { notes: "VIP" }),
    ]);
    const { availablePoolRooms } = await getHousekeeperMobileData(7, date);
    expect(availablePoolRooms.map((item) => item.id)).toEqual([2, 1]);
  });

  it("excludes any active session across dates/owners and reports the actual owner on assigned conflicts", async () => {
    db.room.findMany.mockResolvedValue([room(1), room(2), room(3), room(4)]);
    db.housekeepingAssignment.findMany.mockResolvedValue([assignment(1)]);
    const startedAt = new Date("2026-09-16T23:00:00Z");
    // The first call is the existing date-scoped loader; the second is the all-date overlay.
    db.cleaningSession.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { roomId: 1, housekeeperId: 8, startedAt },
      { roomId: 1, housekeeperId: 9, startedAt: yesterday },
      { roomId: 2, housekeeperId: 8, startedAt: yesterday },
      { roomId: 3, housekeeperId: 7, startedAt: yesterday },
    ]);

    const result = await getHousekeeperMobileData(7, date);
    expect(result.myRooms[0]).toMatchObject({ inProgress: true, startedAt, activeHousekeeperId: 8 });
    expect(result.availablePoolRooms.map((item) => item.id)).toEqual([4]);
    expect(result.availablePoolRooms[0]).toMatchObject({ inProgress: false, startedAt: null, activeHousekeeperId: null });
    expect(result.allHotelRooms).toHaveLength(4);
    expect(db.cleaningSession.findMany).toHaveBeenLastCalledWith({
      where: { roomId: { in: [1, 2, 3, 4] }, startedAt: { not: null }, finishedAt: null },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: { roomId: true, housekeeperId: true, startedAt: true },
    });
  });

  it("defaults to the hotel day and returns empty collections for an empty hotel", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T18:00:00Z"));
    expect(await getHousekeeperMobileData(7)).toEqual({ date, myRooms: [], availablePoolRooms: [], allHotelRooms: [] });
    expect(db.housekeepingAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { date } }));
  });
});
