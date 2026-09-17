import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HOUSEKEEPING_PRIORITY_CONFIG,
  PRIORITY_CONFIG,
  housekeepingTaskCode,
  resolveRoomPriority,
  sortHousekeepingRows,
  type HousekeepingPriorityReservation,
} from "../housekeeping-priority";
import {
  getHousekeepingListData,
  PRIORITY_CONFIG as reexportedPriorityConfig,
  type HousekeepingPriorityInfo,
} from "../housekeeping-list-data";

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
function reservation(overrides: Partial<HousekeepingPriorityReservation> = {}): HousekeepingPriorityReservation {
  return { status: "CONFIRMED", arrivalDate: date, departureDate: tomorrow, notes: null, stayFees: [], ...overrides };
}
const departure = reservation({ status: "CHECKED_OUT", arrivalDate: yesterday, departureDate: date });

 describe("resolveRoomPriority", () => {
  it.each([
    reservation({ notes: "ETA 13:59" }),
    reservation({ notes: "Tamu VIP" }),
    reservation({ stayFees: [{ kind: "EARLY_CHECK_IN", status: "PENDING" }] }),
    reservation({ stayFees: [{ kind: "EARLY_CHECK_IN", status: "POSTED" }] }),
  ])("prioritizes urgent confirmed arrivals over turnover", (arrival) => {
    expect(resolveRoomPriority({ status: "VD", date, reservations: [departure, arrival] })).toBe("P1");
  });
  it.each(["ETA 14:00", "ETA 29:00", "ETA 24:00", "VIPER", null])("does not treat %s as urgent", (notes) => {
    expect(resolveRoomPriority({ status: "VD", date, reservations: [reservation({ notes })] })).toBe("P5");
  });
  it("ignores cancelled early fees and late checkout fees", () => {
    const arrival = reservation({ stayFees: [{ kind: "EARLY_CHECK_IN", status: "CANCELLED" }, { kind: "LATE_CHECK_OUT", status: "PENDING" }] });
    expect(resolveRoomPriority({ status: "VD", date, reservations: [arrival] })).toBe("P5");
  });
  it("requires selected-date confirmed arrival for urgency", () => {
    for (const arrival of [reservation({ arrivalDate: tomorrow, notes: "VIP" }), reservation({ status: "CHECKED_IN", notes: "VIP" })]) {
      expect(resolveRoomPriority({ status: "VD", date, reservations: [arrival] })).toBe("P5");
    }
  });
  it("keeps turnover priority after checkout and respects ordered rules", () => {
    expect(resolveRoomPriority({ status: "VD", date, reservations: [departure, reservation()] })).toBe("P2");
    expect(resolveRoomPriority({ status: "VD", date, reservations: [departure] })).toBe("P3");
    expect(resolveRoomPriority({ status: "OD", date, reservations: [reservation({ status: "CHECKED_IN", departureDate: date })] })).toBe("P3");
  });
  it("uses P4 only for an in-house OD room", () => {
    const stay = reservation({ status: "CHECKED_IN", arrivalDate: yesterday });
    expect(resolveRoomPriority({ status: "OD", date, reservations: [stay] })).toBe("P4");
    expect(resolveRoomPriority({ status: "OC", date, reservations: [stay] })).toBe("P5");
    expect(resolveRoomPriority({ status: "OD", date, reservations: [] })).toBe("P5");
  });
  it("falls back for VC and irrelevant departures", () => {
    expect(resolveRoomPriority({ status: "VC", date, reservations: [departure, reservation({ notes: "VIP" })] })).toBe("P5");
    expect(resolveRoomPriority({ status: "VD", date, reservations: [reservation({ status: "CANCELLED", departureDate: date }), { ...departure, departureDate: yesterday }] })).toBe("P5");
  });
});

describe("task codes and sorting", () => {
  const rows = [
    { room: { id: 1, number: "10", floor: 2, status: "VD" as const }, priority: "P2" as const, assignedHousekeeper: { name: "Zara" } },
    { room: { id: 2, number: "2", floor: 2, status: "OD" as const }, priority: "P2" as const, assignedHousekeeper: { name: "Ani" } },
    { room: { id: 3, number: "3", floor: 1, status: "VC" as const }, priority: "P1" as const, assignedHousekeeper: null },
  ];
  it("provides ranked labels and styles for every priority", () => {
    const configs: HousekeepingPriorityInfo[] = Object.values(PRIORITY_CONFIG);
    expect(configs.map((config) => config.label)).toEqual([
      "Mendesak", "Pergantian Cepat", "Keberangkatan", "Menginap", "Rutin",
    ]);
    expect(configs.map((config) => config.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(HOUSEKEEPING_PRIORITY_CONFIG).toBe(PRIORITY_CONFIG);
    expect(reexportedPriorityConfig).toBe(PRIORITY_CONFIG);
    for (const config of configs) {
      expect(config.label).toBeTruthy();
      expect(config.className).toBeTruthy();
    }
  });
  it("derives a stable task code from the room number", () => {
    expect(housekeepingTaskCode("010A")).toBe("TSK-010A");
  });
  it("defaults to priority with natural ascending room ties without mutating input", () => {
    expect(sortHousekeepingRows(rows).map((row) => row.room.number)).toEqual(["3", "2", "10"]);
    expect(sortHousekeepingRows(rows, "priority", "desc").map((row) => row.room.number)).toEqual(["2", "10", "3"]);
    expect(rows[0].room.number).toBe("10");
  });
  it.each([
    ["room", "asc", ["2", "3", "10"]],
    ["room", "desc", ["10", "3", "2"]],
    ["floor", "asc", ["3", "2", "10"]],
    ["floor", "desc", ["2", "10", "3"]],
    ["status", "asc", ["2", "3", "10"]],
    ["assignee", "asc", ["3", "2", "10"]],
    ["assignee", "desc", ["10", "2", "3"]],
  ] as const)("sorts %s %s", (key, order, numbers) => {
    expect(sortHousekeepingRows(rows, key, order).map((row) => row.room.number)).toEqual(numbers);
  });
});

describe("getHousekeepingListData (mocked database)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.room.findMany.mockResolvedValue([{ id: 1, number: "102", floor: 1, status: "VD", roomType: { name: "Deluks", code: "DLX" } }]);
    db.reservation.findMany.mockResolvedValue([{ ...departure, id: 1, roomId: 1, reservationNo: "RSV-001", guest: { fullName: "Budi Santoso" } }]);
    db.housekeepingAssignment.findMany.mockResolvedValue([{ roomId: 1, housekeeper: { id: 2, fullName: "Siti Aminah" } }]);
    db.cleaningSession.findMany.mockResolvedValue([]);
    db.housekeepingLog.findMany.mockResolvedValue([{ roomId: 1, note: "[TUGAS: Bersihkan kaca]" }, { roomId: 1, note: "[TUGAS: Catatan lama]" }]);
  });
  it("preserves positional API, reservation note and checked-out departure", async () => {
    const result = await getHousekeepingListData(date, "Budi", "VD");
    expect(result.rows[0]).toMatchObject({ priority: "P3", taskCode: "TSK-102", taskNote: "[TUGAS: Bersihkan kaca]", note: { reservationNo: "RSV-001", etaLabel: null, notes: null }, reservationContexts: [{ kind: "departure", label: "Keberangkatan" }] });
    expect(db.reservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ status: { in: ["CHECKED_IN", "CHECKED_OUT"] }, departureDate: date })]) }),
      select: expect.objectContaining({ stayFees: { where: { kind: "EARLY_CHECK_IN", status: { not: "CANCELLED" } }, select: { kind: true, status: true } } }),
    }));
  });
  it("scopes task logs to the selected WIB day, newest first with deterministic ties", async () => {
    await getHousekeepingListData({ date });
    expect(db.housekeepingLog.findMany).toHaveBeenCalledWith({
      where: { note: { startsWith: "[TUGAS:" }, updatedAt: { gte: new Date("2026-09-16T17:00:00Z"), lt: new Date("2026-09-17T17:00:00Z") } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { roomId: true, note: true },
    });
  });
  it.each(["102", "tsk-102", "deluks", "dlx", "pembersihan", "siti", "rsv-001", "budi", "  BUDI  "])("searches %s across row context", async (q) => {
    expect((await getHousekeepingListData({ date, q })).rows).toHaveLength(1);
    expect(db.room.findMany.mock.calls[0][0].where).not.toHaveProperty("number");
  });
  it("combines priority and search filters", async () => {
    expect((await getHousekeepingListData({ date, q: "Budi", priority: "P3" })).rows).toHaveLength(1);
    expect((await getHousekeepingListData({ date, priority: "P1" })).rows).toHaveLength(0);
    expect((await getHousekeepingListData({ date, q: "unknown" })).rows).toHaveLength(0);
  });
  it("returns null task notes when there are no matching logs", async () => {
    db.housekeepingLog.findMany.mockResolvedValue([]);
    expect((await getHousekeepingListData({ date })).rows[0].taskNote).toBeNull();
  });
});
