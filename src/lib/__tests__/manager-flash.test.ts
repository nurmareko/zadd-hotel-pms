import { ArticleType, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audits: vi.fn(),
  activityLogs: vi.fn(),
  rooms: vi.fn(),
  reservations: vi.fn(),
  reservationCount: vi.fn(),
  lines: vi.fn(),
  orders: vi.fn(),
  orderRevenue: vi.fn(),
  arr: vi.fn(),
  cutover: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    nightAudit: { findMany: mocks.audits },
    activityLog: { findMany: mocks.activityLogs },
    room: { count: mocks.rooms },
    reservation: { findMany: mocks.reservations, count: mocks.reservationCount },
    folioLineItem: { findMany: mocks.lines },
    fBOrder: { findMany: mocks.orders, aggregate: mocks.orderRevenue },
  },
}));
vi.mock("@/lib/arr", () => ({
  computeArr: mocks.arr,
  getArrCutover: mocks.cutover,
}));

import { getManagerFlashReport } from "@/lib/manager-flash";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

const date = "2026-08-02";
const timestampRange = {
  gte: new Date("2026-08-01T17:00:00.000Z"),
  lt: new Date("2026-08-02T17:00:00.000Z"),
};
const dateRange = {
  gte: new Date("2026-08-02T00:00:00.000Z"),
  lt: new Date("2026-08-03T00:00:00.000Z"),
};
const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const line = (amount: Prisma.Decimal.Value, type: ArticleType, code = type.toString()) => ({
  amount: decimal(amount),
  article: { code, type },
});

function audit(otherRevenue: number) {
  return {
    businessDate: dateRange.gte,
    roomsOccupied: 2,
    occupancyRate: decimal(20),
    roomRevenue: decimal(1000),
    fbRevenue: decimal(200),
    otherRevenue: decimal(otherRevenue),
    totalRevenue: decimal(1200 + otherRevenue),
    inHouseCount: 2,
    checkInCount: 1,
    checkOutCount: 0,
  };
}

function setLines(other: ReturnType<typeof line>[], stay: ReturnType<typeof line>[] = []) {
  mocks.lines.mockImplementation(async (args: Prisma.FolioLineItemFindManyArgs) => {
    // Booking-source reads are independent of the department revenue projection.
    if (!args.select?.article) return [];
    if (args.where?.reservationNight) return stay;
    const postedAt = args.where?.postedAt as Prisma.DateTimeFilter | undefined;
    return postedAt?.gte instanceof Date &&
      postedAt.gte.getTime() === timestampRange.gte.getTime() ? other : [];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.audits.mockResolvedValue([]);
  mocks.activityLogs.mockResolvedValue([]);
  mocks.rooms.mockResolvedValue(10);
  mocks.reservations.mockResolvedValue([]);
  mocks.reservationCount.mockResolvedValue(0);
  mocks.lines.mockResolvedValue([]);
  mocks.orders.mockResolvedValue([]);
  mocks.orderRevenue.mockResolvedValue({ _sum: { total: null } });
  mocks.arr.mockResolvedValue({ paidRoomNights: 2, arr: decimal(500) });
  mocks.cutover.mockResolvedValue({ status: "ready" });
});

function overrideMetadata(standardRates: number[], customRate: number) {
  return {
    rateOverride: true,
    nights: standardRates.map((standardRate) => ({
      date: "2026-09-01",
      standardRate, customRate, variance: customRate - standardRate,
    })),
  };
}

describe("getManagerFlashReport rate discounts", () => {
  it.each([false, true])("summarizes variable nightly discounts independently of revenue (audited: %s)", async (audited) => {
    if (audited) mocks.audits.mockResolvedValue([audit(50)]);
    setLines([line(50, ArticleType.MISC)], [line(1000, ArticleType.ROOM, ROOM_CHARGE_ARTICLE_CODE)]);
    mocks.orderRevenue.mockResolvedValue({ _sum: { total: decimal(200) } });
    mocks.activityLogs.mockResolvedValue([
      { createdAt: timestampRange.gte, metadata: overrideMetadata([500, 700], 400) },
      { createdAt: timestampRange.gte, metadata: overrideMetadata([300, 700], 400) },
      { createdAt: timestampRange.gte, metadata: overrideMetadata([100, 200], 400) },
      { createdAt: timestampRange.gte, metadata: overrideMetadata([300, 500], 400) },
      { createdAt: timestampRange.gte, metadata: { rateOverride: true, nights: [] } },
    ]);

    const { selected, history } = await getManagerFlashReport(date);

    expect(selected).toMatchObject({
      rateDiscountsTotal: 600, rateOverrideCount: 5,
      roomRevenue: 1000, fbRevenue: 200, otherRevenue: 50, totalRevenue: 1250,
      adr: 500, revPar: 100, soldRoomNights: 2,
    });
    expect(history.slice(1).every((day) => day.rateDiscountsTotal === 0 && day.rateOverrideCount === 0)).toBe(true);
  });

  it("queries once for all 14 hotel days and buckets creation timestamps at midnight boundaries", async () => {
    const logs = [
      "2026-07-19T16:59:59.999Z", // Before the history window.
      "2026-07-19T17:00:00.000Z", // First history day, inclusive.
      "2026-08-01T16:59:59.999Z", // Previous hotel day.
      "2026-08-01T17:00:00.000Z", // Selected hotel day, inclusive.
      "2026-08-02T16:59:59.999Z", // Selected hotel day's final millisecond.
      "2026-08-02T17:00:00.000Z", // Following hotel day, excluded.
    ].map((createdAt) => ({ createdAt: new Date(createdAt), metadata: overrideMetadata([500, 700], 400) }));
    mocks.activityLogs.mockImplementation(async (args: Prisma.ActivityLogFindManyArgs) => {
      const range = args.where?.createdAt as { gte: Date; lt: Date };
      return logs.filter((log) => log.createdAt >= range.gte && log.createdAt < range.lt);
    });

    const { selected, history } = await getManagerFlashReport(date);

    expect(mocks.activityLogs).toHaveBeenCalledTimes(1);
    expect(mocks.activityLogs).toHaveBeenCalledWith({
      where: {
        action: "RESERVATION_CREATED",
        metadata: { path: ["rateOverride"], equals: true },
        createdAt: { gte: new Date("2026-07-19T17:00:00.000Z"), lt: timestampRange.lt },
      },
      select: { createdAt: true, metadata: true },
    });
    expect(selected).toMatchObject({ rateDiscountsTotal: 800, rateOverrideCount: 2 });
    expect(history[1]).toMatchObject({ date: "2026-08-01", rateDiscountsTotal: 400, rateOverrideCount: 1 });
    expect(history[13]).toMatchObject({ date: "2026-07-20", rateDiscountsTotal: 400, rateOverrideCount: 1 });
    expect(history.reduce((sum, day) => sum + day.rateOverrideCount, 0)).toBe(4);
  });

  it("returns zero discounts and overrides when no creation logs match", async () => {
    const { history } = await getManagerFlashReport(date);
    expect(history.every((day) => day.rateDiscountsTotal === 0 && day.rateOverrideCount === 0)).toBe(true);
  });
});

describe("getManagerFlashReport department revenue", () => {
  it("splits unaudited revenue four ways and excludes room/FB/canonical room-code other lines", async () => {
    setLines([
      line(30, ArticleType.SERVICE),
      line(20, ArticleType.MISC),
      line(-5, ArticleType.MISC),
      line(900, ArticleType.ROOM),
      line(800, ArticleType.FB),
      line(700, ArticleType.SERVICE, ROOM_CHARGE_ARTICLE_CODE),
    ], [line(1000, ArticleType.ROOM, ROOM_CHARGE_ARTICLE_CODE), line(50, ArticleType.FB)]);
    mocks.orderRevenue.mockResolvedValue({ _sum: { total: decimal(150) } });

    const report = await getManagerFlashReport(date);

    expect(report.selected).toMatchObject({
      roomRevenue: 1000, fbRevenue: 200, hkRevenue: 30, miscRevenue: 15,
      otherRevenue: 45, totalRevenue: 1245, adr: 500, soldRoomNights: 2,
    });
    expect(report.history).toHaveLength(14);
    expect(mocks.lines).toHaveBeenCalledWith({
      where: { postedAt: timestampRange, fbOrderId: null, reservationNightId: null },
      select: { amount: true, article: { select: { code: true, type: true } } },
    });
    expect(mocks.lines).toHaveBeenCalledWith({
      where: { reservationNight: { date: dateRange }, fbOrderId: null },
      select: { amount: true, article: { select: { code: true, type: true } } },
    });
    expect(mocks.orderRevenue).toHaveBeenCalledWith({
      where: { status: "CLOSED", closedAt: timestampRange }, _sum: { total: true },
    });
  });

  it("reconciles audited departments without replacing stored revenue or operational metrics", async () => {
    mocks.audits.mockResolvedValue([audit(50)]);
    setLines([
      line(30, ArticleType.SERVICE), line(20, ArticleType.MISC),
      line(900, ArticleType.ROOM), line(800, ArticleType.FB),
      line(700, ArticleType.SERVICE, ROOM_CHARGE_ARTICLE_CODE),
    ]);

    const { selected } = await getManagerFlashReport(date);

    expect(selected).toMatchObject({
      roomRevenue: 1000, fbRevenue: 200, hkRevenue: 30, miscRevenue: 20,
      otherRevenue: 50, totalRevenue: 1250, occupancyRate: 20, roomsOccupied: 2,
      inHouseCount: 2, checkInCount: 1, checkOutCount: 0, revPax: 625,
    });
    expect(mocks.lines).toHaveBeenCalledWith({
      where: { postedAt: timestampRange, fbOrderId: null },
      select: { amount: true, article: { select: { code: true, type: true } } },
    });
  });

  it.each([
    { name: "empty", stored: 50, lines: [] },
    { name: "zero", stored: 0, lines: [line(30, ArticleType.SERVICE), line(-30, ArticleType.MISC)] },
    { name: "mismatched", stored: 50, lines: [line(30, ArticleType.SERVICE)] },
    { name: "excluded only", stored: 50, lines: [line(50, ArticleType.ROOM)] },
    { name: "negative mismatch", stored: -50, lines: [line(-30, ArticleType.SERVICE)] },
  ])("preserves stored other revenue for $name audited attribution", async ({ stored, lines }) => {
    mocks.audits.mockResolvedValue([audit(stored)]);
    setLines(lines);

    const { selected } = await getManagerFlashReport(date);

    expect(selected).toMatchObject({
      hkRevenue: 0, miscRevenue: stored, otherRevenue: stored, totalRevenue: 1200 + stored,
    });
  });

  it("queries and reconciles negative audited other revenue", async () => {
    mocks.audits.mockResolvedValue([audit(-50)]);
    setLines([line(-30, ArticleType.SERVICE), line(-20, ArticleType.MISC)]);

    const { selected } = await getManagerFlashReport(date);

    expect(selected).toMatchObject({ hkRevenue: -30, miscRevenue: -20, otherRevenue: -50, totalRevenue: 1150 });
    expect(mocks.lines).toHaveBeenCalledWith({
      where: { postedAt: timestampRange, fbOrderId: null },
      select: { amount: true, article: { select: { code: true, type: true } } },
    });
  });

  it("returns zero departmental revenue for empty unaudited days", async () => {
    const { selected } = await getManagerFlashReport(date);
    expect(selected).toMatchObject({
      roomRevenue: 0, fbRevenue: 0, hkRevenue: 0, miscRevenue: 0, otherRevenue: 0, totalRevenue: 0,
    });
  });
});
