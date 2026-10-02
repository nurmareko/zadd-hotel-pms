import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFBDashboardMetrics,
  getFBDashboardMetrics,
  resolveFBDashboardDate,
  type FBDashboardOrder,
  type FBDashboardKitchenOrder,
} from "./dashboard-metrics";

const db = vi.hoisted(() => ({ findMany: vi.fn(), loaded: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  db.loaded();
  return { prisma: { fBOrder: { findMany: db.findMany } } };
});

const now = new Date("2026-06-01T05:00:00.987Z");
const start = new Date("2026-05-31T17:00:00.000Z");
const end = new Date("2026-06-01T17:00:00.000Z");
function order(overrides: Partial<FBDashboardOrder> = {}): FBDashboardOrder {
  return {
    id: 1, orderNo: "FB-001", status: "CLOSED", serviceType: "DINE_IN",
    paymentMethod: "CASH", total: 100, guestCount: 2,
    openedAt: start, closedAt: new Date("2026-06-01T02:00:00Z"),
    table: { number: "T1" }, tableNo: "legacy", chargedFolio: null,
    items: [{ menuItemId: 1, menuItem: { name: "Nasi" }, quantity: 2, amount: 80 }],
    ...overrides,
  };
}
function kitchen(overrides: Partial<FBDashboardKitchenOrder> = {}): FBDashboardKitchenOrder {
  return {
    status: "OPEN", kitchenStartedAt: new Date("2026-06-01T00:00:00Z"),
    kitchenReadyAt: new Date("2026-06-01T00:10:00Z"), ...overrides,
  };
}
const compute = (orders: FBDashboardOrder[] = [], kitchens: FBDashboardKitchenOrder[] = []) =>
  computeFBDashboardMetrics(orders, kitchens, "2026-06-01", now);

 describe("resolveFBDashboardDate", () => {
  it("defaults to the current WIB day without millisecond drift or mutating now", () => {
    expect(resolveFBDashboardDate(undefined, now)).toEqual({ date: "2026-06-01", start, end });
    expect(now.getUTCMilliseconds()).toBe(987);
  });
  it.each(["", "invalid", "2026-02-29", "2024-02-30", "2026-6-1", "2026-06-01T00:00:00Z"])(
    "safely falls back to today for invalid query %s", (date) => {
      expect(resolveFBDashboardDate(date, now)).toEqual({ date: "2026-06-01", start, end });
    },
  );
  it("accepts leap dates and rolls over month/year boundaries", () => {
    expect(resolveFBDashboardDate("2024-02-29", now)).toEqual({
      date: "2024-02-29", start: new Date("2024-02-28T17:00:00Z"), end: new Date("2024-02-29T17:00:00Z"),
    });
    expect(resolveFBDashboardDate("2026-01-01", now).start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });
  it("interprets Dates as WIB instants on either side of midnight", () => {
    expect(resolveFBDashboardDate(new Date("2026-05-31T16:59:59.999Z"), now).date).toBe("2026-05-31");
    expect(resolveFBDashboardDate(new Date("2026-05-31T17:00:00.999Z"), now)).toEqual({ date: "2026-06-01", start, end });
    expect(resolveFBDashboardDate(new Date(NaN), now)).toEqual({ date: "2026-06-01", start, end });
  });
});

describe("computeFBDashboardMetrics", () => {
  it("returns zeros, null kitchen average, and all fixed buckets without loading Prisma", () => {
    expect(db.loaded).not.toHaveBeenCalled();
    expect(compute()).toEqual({
      date: "2026-06-01", settledCount: 0, grossSales: 0, averageBill: 0, covers: 0,
      openBillCount: 0, openBillTotal: 0, complimentaryCount: 0, complimentaryTotal: 0,
      kitchenAverageMinutes: null, kitchenCompletedCount: 0,
      salesByService: ["DINE_IN", "ROOM_SERVICE"].map((serviceType) => ({ serviceType, count: 0, total: 0 })),
      salesByTender: ["CASH", "TRANSFER", "CARD", "CHARGE_TO_ROOM"].map((paymentMethod) => ({ paymentMethod, count: 0, total: 0 })),
      topItems: [], openBills: [], voidedBills: [],
    });
  });
  it("uses closed totals and covers, averages per bill, and groups service and tender", () => {
    const result = compute([
      order({ total: { toString: () => "100.50" } }),
      order({ id: 2, total: "200.50", serviceType: "ROOM_SERVICE", paymentMethod: "CHARGE_TO_ROOM", guestCount: 3 }),
      order({ id: 3, total: 50, paymentMethod: "CARD", guestCount: 1 }),
      order({ id: 4, total: 49, paymentMethod: "TRANSFER", guestCount: 1 }),
    ]);
    expect(result).toMatchObject({ settledCount: 4, grossSales: 400, averageBill: 100, covers: 7 });
    expect(result.salesByService).toEqual([
      { serviceType: "DINE_IN", count: 3, total: 199.5 }, { serviceType: "ROOM_SERVICE", count: 1, total: 200.5 },
    ]);
    expect(result.salesByTender.map((bucket) => bucket.total)).toEqual([100.5, 49, 50, 200.5]);
  });
  it("keeps unknown payment distinct and does not invent complimentary orders", () => {
    const result = compute([order({ paymentMethod: null }), order({ total: 0 })]);
    expect(result.salesByTender).toContainEqual({ paymentMethod: "UNKNOWN", count: 1, total: 100 });
    expect(result.salesByTender[0]).toEqual({ paymentMethod: "CASH", count: 1, total: 0 });
    expect(result).toMatchObject({ settledCount: 2, averageBill: 50, complimentaryCount: 0, complimentaryTotal: 0 });
  });
  it("uses half-open closedAt boundaries regardless of openedAt for sales", () => {
    const result = compute([
      order({ closedAt: start, openedAt: new Date("2026-05-30T00:00:00Z") }),
      order({ closedAt: new Date(end.getTime() - 1) }),
      order({ closedAt: end }), order({ closedAt: new Date(start.getTime() - 1) }),
      order({ closedAt: null }), order({ status: "VOIDED" }), order({ status: "OPEN" }),
    ]);
    expect(result).toMatchObject({ settledCount: 2, grossSales: 200, covers: 4 });
    expect(result.topItems[0].quantity).toBe(4);
  });
  it("counts only active orders opened in the day and clamps future elapsed time", () => {
    const result = compute([
      order({ id: 1, status: "OPEN", openedAt: start }),
      order({ id: 2, status: "BILLED", total: 200, openedAt: new Date(now.getTime() - 90_000) }),
      order({ id: 3, status: "OPEN", openedAt: new Date(end.getTime() - 1) }),
      order({ status: "OPEN", openedAt: end }),
      order({ status: "BILLED", openedAt: new Date(start.getTime() - 1) }),
    ]);
    expect(result).toMatchObject({ openBillCount: 3, openBillTotal: 400, settledCount: 0, covers: 0 });
    expect(result.openBills.map((bill) => bill.elapsedMinutes)).toEqual([720, 1, 0]);
  });
  it("resolves table relation before legacy table number, then room, then unknown", () => {
    const result = compute([
      order({ status: "OPEN" }),
      order({ status: "OPEN", table: null }),
      order({ status: "OPEN", table: null, tableNo: null, chargedFolio: { reservation: { room: { number: "101" } } } }),
      order({ status: "OPEN", table: null, tableNo: null }),
    ]);
    expect(result.openBills.map((bill) => bill.location)).toEqual(["Meja T1", "Meja legacy", "Kamar 101", "—"]);
  });
  it("lists voids only by closedAt, without contributing sales or active totals", () => {
    const result = compute([
      order({ status: "VOIDED", closedAt: start, openedAt: new Date("2026-05-01T00:00:00Z") }),
      order({ status: "VOIDED", closedAt: end }), order({ status: "VOIDED", closedAt: null }),
      order({ status: "VOIDED", closedAt: new Date(start.getTime() - 1) }),
    ]);
    expect(result.voidedBills).toEqual([{ id: 1, orderNo: "FB-001", location: "Meja T1", total: 100, closedAt: start }]);
    expect(result).toMatchObject({ grossSales: 0, openBillTotal: 0 });
  });
  it("aggregates item quantities and snapshot amounts, ranking quantity then revenue", () => {
    const result = compute([
      order({ items: [
        { menuItemId: 1, menuItem: { name: "Nasi" }, quantity: 2, amount: 30 },
        { menuItemId: 2, menuItem: { name: "Teh" }, quantity: 4, amount: 40 },
        { menuItemId: 3, menuItem: { name: "Kopi" }, quantity: 4, amount: 60 },
      ] }),
      order({ items: [{ menuItemId: 1, menuItem: { name: "Nasi" }, quantity: 3, amount: "45" }] }),
    ]);
    expect(result.topItems).toEqual([
      { menuItemId: 1, name: "Nasi", quantity: 5, revenue: 75 },
      { menuItemId: 3, name: "Kopi", quantity: 4, revenue: 60 },
      { menuItemId: 2, name: "Teh", quantity: 4, revenue: 40 },
    ]);
  });
  it("measures kitchen completion independently of sales, including cross-midnight prep", () => {
    const result = compute([], [
      kitchen({ kitchenStartedAt: new Date(start.getTime() - 20 * 60_000), kitchenReadyAt: start }),
      kitchen({ status: "BILLED" }), kitchen({ status: "CLOSED" }),
      kitchen({ kitchenStartedAt: start, kitchenReadyAt: start }),
      kitchen({ kitchenReadyAt: end }), kitchen({ kitchenReadyAt: new Date(start.getTime() - 1) }),
      kitchen({ status: "VOIDED" }), kitchen({ kitchenStartedAt: null }), kitchen({ kitchenReadyAt: null }),
      kitchen({ kitchenStartedAt: new Date("2026-06-01T00:11:00Z") }),
    ]);
    expect(result).toMatchObject({ settledCount: 0, kitchenCompletedCount: 4, kitchenAverageMinutes: 10 });
  });
});

describe("getFBDashboardMetrics", () => {
  beforeEach(() => { db.findMany.mockReset(); });
  it("lazily queries the actual relations with separate sales and kitchen day predicates", async () => {
    db.findMany.mockResolvedValueOnce([order()]).mockResolvedValueOnce([kitchen()]);
    const result = await getFBDashboardMetrics("2026-06-01", now);
    expect(result).toMatchObject({ grossSales: 100, kitchenCompletedCount: 1, kitchenAverageMinutes: 10 });
    expect(db.findMany).toHaveBeenCalledTimes(2);
    expect(db.findMany.mock.calls[0][0]).toMatchObject({
      where: { OR: [
        { status: "CLOSED", closedAt: { gte: start, lt: end } },
        { status: { in: ["OPEN", "BILLED"] }, openedAt: { gte: start, lt: end } },
        { status: "VOIDED", closedAt: { gte: start, lt: end } },
      ] },
      select: {
        table: { select: { number: true } },
        chargedFolio: { select: { reservation: { select: { room: { select: { number: true } } } } } },
        items: { select: { menuItemId: true, quantity: true, amount: true, menuItem: { select: { name: true } } } },
      },
    });
    expect(db.findMany.mock.calls[1][0]).toEqual({
      where: { status: { not: "VOIDED" }, kitchenStartedAt: { not: null }, kitchenReadyAt: { gte: start, lt: end } },
      select: { status: true, kitchenStartedAt: true, kitchenReadyAt: true },
    });
  });
  it("uses normalized fallback boundaries for invalid query input", async () => {
    db.findMany.mockResolvedValue([]);
    expect((await getFBDashboardMetrics("2026-02-30", now)).date).toBe("2026-06-01");
    expect(db.findMany.mock.calls[1][0].where.kitchenReadyAt).toEqual({ gte: start, lt: end });
  });
});
