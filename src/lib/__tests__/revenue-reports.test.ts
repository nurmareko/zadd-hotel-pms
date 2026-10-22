import { ArticleType, Prisma, ReservationType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  activityLog: { findMany: vi.fn() },
  nightAudit: { findMany: vi.fn() },
  room: { count: vi.fn() },
  reservation: { findMany: vi.fn() },
  folioLineItem: { findMany: vi.fn() },
  fBOrder: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/arr", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/arr")>(),
  computeArr: vi.fn(),
  getArrCutover: vi.fn(),
  inclusiveArrRange: vi.fn((await importOriginal<typeof import("@/lib/arr")>()).inclusiveArrRange),
}));
vi.mock("@/lib/night-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/night-audit")>();
  return { ...actual, classifyNightAuditRevenues: vi.fn(actual.classifyNightAuditRevenues) };
});

import { computeArr, getArrCutover, inclusiveArrRange, type ArrResult, type ArrStatus } from "@/lib/arr";
import { classifyNightAuditRevenues } from "@/lib/night-audit";
import { getRateVarianceReport, getRevenueReport, resolveRevenueReportRange, safeDivide, summarizeRateOverride } from "@/lib/revenue-reports";

const decimal = (value: number) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const cutover = { ok: true as const, date: date("2026-01-01"), source: "CONFIG" as const };
const window = { from: "2026-09-01", to: "2026-09-02" };
function arrResult(input: Parameters<typeof computeArr>[0], status: ArrStatus = "AUTHORITATIVE", amount = 123): ArrResult {
  return { ...input, status, numerator: decimal(amount), paidRoomNights: 1,
    arr: status === "AUTHORITATIVE" ? decimal(amount) : null, cutoverDate: cutover.date };
}
function reservation(id: number, type: ReservationType, roomId: number | null, nights = ["2026-09-01", "2026-09-02"]) {
  return { id, reservationType: type, roomId, status: "CONFIRMED", arrivalDate: date("2026-09-01"), departureDate: date("2026-09-03"),
    reservationNights: nights.map((day, index) => ({ id: id * 10 + index, date: date(day) })) };
}
function line(amount: number, type: ArticleType, serviceDate: string | null, source = ReservationType.INDIVIDUAL, code: string = type) {
  return { amount: decimal(amount), article: { type, code },
    reservationNight: serviceDate ? { date: date(serviceDate) } : null,
    postedAt: new Date("2026-09-01T17:00:00.000Z"),
    folio: { reservation: { reservationType: source } } };
}
function audit(day: string, totalRooms: number, roomsOccupied: number, roomRevenue: number) {
  return { businessDate: date(day), totalRooms, roomsOccupied, occupancyRate: decimal(roomsOccupied / totalRooms * 100),
    roomRevenue: decimal(roomRevenue), fbRevenue: decimal(20), otherRevenue: decimal(10), totalRevenue: decimal(roomRevenue + 30) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
  db.activityLog.findMany.mockResolvedValue([]);
  db.nightAudit.findMany.mockResolvedValue([]);
  db.room.count.mockResolvedValue(10);
  db.reservation.findMany.mockResolvedValue([]);
  db.folioLineItem.findMany.mockResolvedValue([]);
  db.fBOrder.findMany.mockResolvedValue([]);
  vi.mocked(getArrCutover).mockResolvedValue(cutover);
  vi.mocked(computeArr).mockImplementation(async (input) => arrResult(input));
});
afterEach(() => vi.useRealTimers());

describe("resolveRevenueReportRange", () => {
  it("defaults to the hotel month, including at the WIB/UTC month boundary", () => {
    vi.setSystemTime(new Date("2026-08-31T17:01:00Z"));
    expect(resolveRevenueReportRange({})).toEqual({ from: "2026-09-01", to: "2026-09-01" });
  });
  it.each([
    { from: "2026-02-30", to: "2026-09-10" },
    { from: "2026-9-01", to: "2026-09-10" },
    { from: "garbage" }, { to: "" },
    { from: "2026-09-20", to: "2026-09-10" },
    { from: "2026-12-20", to: "2026-12-10" },
  ])("falls back for invalid/reversed inputs: %j", (input) => {
    expect(resolveRevenueReportRange(input, "2026-09-24")).toEqual({ from: "2026-09-01", to: "2026-09-24" });
  });
  it("fills missing endpoints independently", () => {
    expect(resolveRevenueReportRange({ from: "2026-08-20" }, "2026-09-24")).toEqual({ from: "2026-08-20", to: "2026-09-24" });
    expect(resolveRevenueReportRange({ to: "2026-09-12" }, "2026-09-24")).toEqual({ from: "2026-09-01", to: "2026-09-12" });
  });
  it("clamps both future endpoints", () => {
    expect(resolveRevenueReportRange({ from: "2026-10-01", to: "2026-10-02" }, "2026-09-24")).toEqual({ from: "2026-09-24", to: "2026-09-24" });
    expect(resolveRevenueReportRange({ from: "2026-09-01", to: "2026-10-02" }, "2026-09-24")).toEqual({ from: "2026-09-01", to: "2026-09-24" });
  });
  it("caps to the latest 366 inclusive days ending at to, not today", () => {
    expect(resolveRevenueReportRange({ from: "2020-01-01", to: "2024-12-31" }, "2026-09-24")).toEqual({ from: "2024-01-01", to: "2024-12-31" });
    expect(resolveRevenueReportRange({ from: "2024-01-01", to: "2024-12-31" }, "2026-09-24")).toEqual({ from: "2024-01-01", to: "2024-12-31" });
  });
});

function overrideMetadata(standards: number[], customRate: number): Prisma.JsonObject {
  return {
    rateOverride: true, standardRate: standards[0] ?? 0, customRate,
    variance: customRate - (standards[0] ?? 0), reason: "Negotiated rate",
    nights: standards.map((standardRate) => ({ standardRate, customRate, variance: customRate - standardRate })),
  };
}

function overrideLog(id: number, metadata: Prisma.JsonValue) {
  return {
    id, createdAt: new Date("2026-09-01T12:00:00Z"), metadata,
    reservationId: id,
    reservation: { id, reservationNo: `RES-${id}`, arrivalDate: date("2026-09-01"), departureDate: date("2026-09-03"),
      guest: { fullName: "Alex Guest" }, roomType: { name: "Deluxe" } },
    user: { fullName: "Front Office Agent" },
  };
}

describe("summarizeRateOverride", () => {
  it("sums variable nightly variances rather than multiplying the first night", () => {
    expect(summarizeRateOverride(overrideMetadata([500, 700], 400))).toEqual({
      totalVariance: -400, standardTotal: 1200, discountAmount: 400, nightsCount: 2,
      standardRate: 500, customRate: 400, reason: "Negotiated rate",
    });
  });
  it("nets premiums against discounts within each stay", () => {
    expect(summarizeRateOverride(overrideMetadata([300, 700], 400))).toMatchObject({ totalVariance: -200, discountAmount: 200 });
    expect(summarizeRateOverride(overrideMetadata([300, 500], 400)).discountAmount).toBe(0);
    expect(summarizeRateOverride(overrideMetadata([100, 200], 400))).toMatchObject({ totalVariance: 500, discountAmount: 0 });
  });
  it.each([null, [], true, 12, "invalid", {}, { nights: {} }, { nights: [] }])("handles empty or malformed metadata: %j", (metadata) => {
    expect(summarizeRateOverride(metadata)).toEqual({ totalVariance: 0, standardTotal: 0, discountAmount: 0,
      nightsCount: 0, standardRate: null, customRate: null, reason: null });
  });
  it("does not invent nightly totals from legacy scalar metadata", () => {
    expect(summarizeRateOverride({ standardRate: 500, customRate: 400, variance: -100, nightsCount: 3 })).toEqual({
      totalVariance: 0, standardTotal: 0, discountAmount: 0, nightsCount: 0, standardRate: 500, customRate: 400, reason: null,
    });
  });
  it("ignores malformed nightly records and rejects coercion and non-finite numbers", () => {
    expect(summarizeRateOverride({
      standardRate: "500", customRate: Infinity, reason: {},
      nights: [null, [], "bad", {}, { standardRate: 100, customRate: 80 },
        { standardRate: "100", customRate: 80, variance: -20 },
        { standardRate: 100, customRate: NaN, variance: -20 },
        { standardRate: 100, customRate: 80, variance: -Infinity },
        { standardRate: 100, customRate: 80, variance: -20 }],
    })).toEqual({ totalVariance: -20, standardTotal: 100, discountAmount: 20, nightsCount: 1,
      standardRate: null, customRate: null, reason: null });
  });
  it("preserves zero rates", () => {
    expect(summarizeRateOverride(overrideMetadata([0], 0))).toMatchObject({
      standardTotal: 0, totalVariance: 0, discountAmount: 0, standardRate: 0, customRate: 0, nightsCount: 1,
    });
  });
});

describe("getRateVarianceReport", () => {
  it("queries creation overrides in the inclusive hotel date range, newest first", async () => {
    await getRateVarianceReport(window);
    expect(db.activityLog.findMany).toHaveBeenCalledWith({
      where: { action: "RESERVATION_CREATED", metadata: { path: ["rateOverride"], equals: true },
        createdAt: { gte: new Date("2026-08-31T17:00:00Z"), lt: new Date("2026-09-02T17:00:00Z") } },
      select: {
        id: true, createdAt: true, metadata: true,
        reservation: { select: {
          id: true, reservationNo: true, arrivalDate: true, departureDate: true,
          guest: { select: { fullName: true } }, roomType: { select: { name: true } },
        } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });
  it("returns an empty report without NaN averages", async () => {
    expect(await getRateVarianceReport(window)).toEqual({ items: [],
      totalOverrides: 0, totalVariance: 0, totalDiscountAmount: 0, averageDiscountPct: 0 });
  });
  it("averages discounted stay percentages arithmetically, excluding premiums and zero standards", async () => {
    db.activityLog.findMany.mockResolvedValue([
      overrideLog(1, overrideMetadata([500, 700], 400)),
      overrideLog(2, overrideMetadata([100], 50)),
      overrideLog(3, overrideMetadata([100], 200)),
      overrideLog(4, overrideMetadata([0], 0)),
      overrideLog(5, overrideMetadata([300, 500], 400)),
    ]);
    const report = await getRateVarianceReport(window);
    expect(report).toEqual({ items: expect.any(Array), totalOverrides: 5, totalVariance: -350, totalDiscountAmount: 450,
      averageDiscountPct: ((400 / 1200 * 100) + 50) / 2 });
    expect(report.items[0]).toEqual({ id: 1, createdAt: "2026-09-01T12:00:00.000Z",
      reservationId: 1, reservationNo: "RES-1", guestName: "Alex Guest",
      arrivalDate: "2026-09-01", departureDate: "2026-09-03",
      roomTypeName: "Deluxe", operatorName: "Front Office Agent", totalVariance: -400, nightsCount: 2,
      standardTotal: 1200, discountAmount: 400, standardRate: 500, customRate: 400, reason: "Negotiated rate" });
  });
  it("retains logs with deleted reservations and malformed metadata safely", async () => {
    db.activityLog.findMany.mockResolvedValue([
      { ...overrideLog(1, overrideMetadata([100], 80)), reservationId: null, reservation: null },
      overrideLog(2, null),
    ]);
    const report = await getRateVarianceReport(window);
    expect(report.items[0]).toMatchObject({ reservationId: null, reservationNo: null, guestName: null, roomTypeName: null,
      arrivalDate: null, departureDate: null, createdAt: "2026-09-01T12:00:00.000Z", operatorName: "Front Office Agent" });
    expect(report).toEqual({ items: expect.any(Array), totalOverrides: 2, totalVariance: -20, totalDiscountAmount: 20, averageDiscountPct: 20 });
  });
});

describe("safeDivide", () => {
  it("guards zero and negative denominators without rounding valid ratios", () => {
    expect(safeDivide(100, 0)).toBe(0);
    expect(safeDivide(0, 0)).toBe(0);
    expect(safeDivide(10, -1)).toBe(0);
    expect(safeDivide(1, 3)).toBe(1 / 3);
  });
});

describe("getRevenueReport", () => {
  it("returns ordered empty days and safe zero-inventory metrics", async () => {
    db.room.count.mockResolvedValue(0);
    vi.mocked(computeArr).mockImplementation(async (input) => arrResult(input, "NO_RECOGNIZED_NIGHTS"));
    const report = await getRevenueReport(window);
    expect(report.dailyRows.map((row) => row.date)).toEqual([window.from, window.to]);
    expect(report.summary).toEqual({ totalRevenue: 0, roomRevenue: 0, fbRevenue: 0, otherRevenue: 0,
      totalRooms: 0, occupiedRooms: 0, occupancyRate: 0, arr: 0, arrStatus: "NO_RECOGNIZED_NIGHTS", revPar: 0 });
    expect(report.sources).toEqual([]);
    expect(report.unattributedRevenue).toBe(0);
  });
  it("preserves closed snapshots and weights period metrics by each day's inventory", async () => {
    db.nightAudit.findMany.mockResolvedValue([audit(window.from, 2, 1, 100)]);
    db.reservation.findMany.mockResolvedValue([reservation(1, "INDIVIDUAL", 1), reservation(2, "OTA", 2)]);
    db.folioLineItem.findMany.mockResolvedValueOnce([line(999, "ROOM", window.from), line(300, "ROOM", window.to)]).mockResolvedValueOnce([]);
    vi.mocked(computeArr).mockImplementation(async (input) => arrResult(input, "AUTHORITATIVE", input.toExclusive.getTime() - input.fromInclusive.getTime() > 86_400_000 ? 777 : 123));
    const report = await getRevenueReport(window);
    expect(report.dailyRows[0]).toMatchObject({ totalRooms: 2, roomsOccupied: 1, occupancyRate: 50, roomRevenue: 100, totalRevenue: 130, revPar: 50 });
    expect(report.dailyRows[1]).toMatchObject({ totalRooms: 10, roomsOccupied: 2, occupancyRate: 20, roomRevenue: 300, revPar: 30 });
    expect(report.summary).toEqual({ totalRooms: 12, occupiedRooms: 3, occupancyRate: 25, roomRevenue: 400, fbRevenue: 20,
      otherRevenue: 10, totalRevenue: 430, revPar: 400 / 12, arr: 777, arrStatus: "AUTHORITATIVE" });
    expect(report.sources.find((row) => row.type === "INDIVIDUAL")?.revenue).toBe(1299);
    expect(classifyNightAuditRevenues).toHaveBeenCalledTimes(1);
  });
  it("uses canonical classification for all article types and separates unlinked FB", async () => {
    const stay = [line(100, "ROOM", window.from, "INDIVIDUAL", "ROOM-CHARGE"), line(20, "FB", window.from), line(3, "SERVICE", window.from)];
    const unlinked = [line(40, "ROOM", null), line(5, "FB", null), line(6, "TAX", null), line(7, "MISC", null)];
    db.folioLineItem.findMany.mockResolvedValueOnce(stay).mockResolvedValueOnce(unlinked);
    db.fBOrder.findMany.mockResolvedValue([
      { total: decimal(30), closedAt: new Date("2026-09-01T16:59:59.999Z"), chargedFolio: { reservation: { reservationType: "OTA" } } },
      { total: decimal(50), closedAt: new Date("2026-09-01T17:00:00Z"), chargedFolio: null },
    ]);
    const report = await getRevenueReport(window);
    expect(report.dailyRows[0]).toMatchObject({ roomRevenue: 100, fbRevenue: 50, otherRevenue: 3, totalRevenue: 153 });
    expect(report.dailyRows[1]).toMatchObject({ roomRevenue: 40, fbRevenue: 55, otherRevenue: 13, totalRevenue: 108 });
    expect(report.summary.totalRevenue).toBe(261);
    expect(report.unattributedRevenue).toBe(50);
    expect(report.sources.find((row) => row.type === "INDIVIDUAL")).toMatchObject({ label: "Individual", revenue: 181, percentage: 181 / 211 * 100, reservationCount: 0 });
    expect(report.sources.find((row) => row.type === "OTA")).toMatchObject({ label: "Online Travel Agent", revenue: 30, percentage: 30 / 211 * 100 });
    expect(report.sources.some((row) => row.type === "WALK_IN")).toBe(false);
    expect(classifyNightAuditRevenues).toHaveBeenCalledWith({ shortfallLineItems: [], existingDaytimeFolioLines: stay, closedFbRevenueTotal: expect.anything(), roomArticleId: undefined });
  });
  it("counts unique reservations across the range and deduplicates occupied rooms", async () => {
    db.reservation.findMany.mockResolvedValue([
      reservation(1, "INDIVIDUAL", 1), reservation(2, "INDIVIDUAL", 1), reservation(3, "INDIVIDUAL", null),
      { ...reservation(4, "OTA", 2, [window.to]), arrivalDate: date(window.to) },
      { ...reservation(5, "COMPANY", 3, []), departureDate: date(window.from) },
    ]);
    const report = await getRevenueReport(window);
    expect(report.sources.find((row) => row.type === "INDIVIDUAL")).toMatchObject({ reservationCount: 3, roomNights: 6, percentage: 0 });
    expect(report.sources.find((row) => row.type === "OTA")).toMatchObject({ reservationCount: 1, roomNights: 1 });
    expect(report.sources.some((row) => row.type === "COMPANY")).toBe(false);
    expect(report.dailyRows.map((row) => row.roomsOccupied)).toEqual([1, 2]);
  });
  it("uses bulk, disjoint service-date and WIB timestamp queries without FB folio duplicates", async () => {
    await getRevenueReport(window);
    const dates = { gte: date(window.from), lt: date("2026-09-03") };
    const timestamps = { gte: new Date("2026-08-31T17:00:00Z"), lt: new Date("2026-09-02T17:00:00Z") };
    expect(db.nightAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "COMPLETED", businessDate: dates }, select: expect.objectContaining({ totalRooms: true, occupancyRate: true }) }));
    expect(db.folioLineItem.findMany).toHaveBeenCalledTimes(2);
    expect(db.folioLineItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { fbOrderId: null, reservationNight: { date: dates } } }));
    expect(db.folioLineItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { fbOrderId: null, reservationNightId: null, postedAt: timestamps } }));
    expect(db.fBOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "CLOSED", closedAt: timestamps } }));
    expect(db.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(db.reservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["CANCELLED", "NO_SHOW"] } }), select: expect.objectContaining({ reservationNights: { where: { date: dates }, select: { id: true } } }) }));
  });
  it.each<ArrStatus>(["AUTHORITATIVE", "UNAVAILABLE", "NO_RECOGNIZED_NIGHTS", "INTEGRITY_ERROR"])("preserves canonical ARR state %s for daily and period results", async (status) => {
    vi.mocked(computeArr).mockImplementation(async (input) => arrResult(input, status));
    const report = await getRevenueReport(window);
    for (const row of [report.summary, ...report.dailyRows]) {
      expect(row.arrStatus).toBe(status);
      expect(row.arr).toBe(status === "AUTHORITATIVE" ? 123 : 0);
    }
    expect(getArrCutover).toHaveBeenCalledTimes(1);
    expect(computeArr).toHaveBeenCalledTimes(3);
    for (const [from, to] of [[window.from, window.to], [window.from, window.from], [window.to, window.to]]) {
      expect(inclusiveArrRange).toHaveBeenCalledWith(from, to);
      expect(computeArr).toHaveBeenCalledWith({ ...inclusiveArrRange(from, to), resolvedCutover: cutover });
    }
    expect(vi.mocked(computeArr).mock.calls.every(([input]) => input.resolvedCutover === cutover)).toBe(true);
  });
  it("retains a period cutover failure even when later days are authoritative", async () => {
    vi.mocked(computeArr).mockImplementation(async (input) => arrResult(input, input.fromInclusive < date(window.to) ? "UNAVAILABLE" : "AUTHORITATIVE"));
    const report = await getRevenueReport(window);
    expect(report.summary.arrStatus).toBe("UNAVAILABLE");
    expect(report.dailyRows.map((row) => row.arrStatus)).toEqual(["UNAVAILABLE", "AUTHORITATIVE"]);
  });
  it("normalizes loader input, caps work and bounds canonical ARR concurrency", async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(computeArr).mockImplementation(async (input) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return arrResult(input);
    });
    const report = await getRevenueReport({ from: "2020-01-01", to: "2099-01-01" });
    expect(report.from).toBe("2025-09-24");
    expect(report.to).toBe("2026-09-24");
    expect(report.dailyRows).toHaveLength(366);
    expect(computeArr).toHaveBeenCalledTimes(367);
    expect(peak).toBeLessThanOrEqual(4);
    expect(db.folioLineItem.findMany).toHaveBeenCalledTimes(2);
    expect(db.nightAudit.findMany).toHaveBeenCalledTimes(1);
  });
  it("propagates database failures rather than presenting a zero revenue report", async () => {
    db.nightAudit.findMany.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(getRevenueReport(window)).rejects.toThrow("database unavailable");
  });
});
