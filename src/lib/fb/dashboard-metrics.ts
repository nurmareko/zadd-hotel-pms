import type { FBOrderServiceType, FBOrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { hotelTodayISO, hotelTodayTimestampRange, isValidISODateOnly } from "@/lib/date-only";

export type FBDashboardMetrics = {
  date: string;
  settledCount: number;
  grossSales: number;
  averageBill: number;
  covers: number;
  openBillCount: number;
  openBillTotal: number;
  complimentaryCount: number;
  complimentaryTotal: number;
  kitchenAverageMinutes: number | null;
  kitchenCompletedCount: number;
  salesByService: { serviceType: string; count: number; total: number }[];
  salesByTender: { paymentMethod: string; count: number; total: number }[];
  topItems: { menuItemId: number; name: string; quantity: number; revenue: number }[];
  openBills: {
    id: number;
    orderNo: string;
    location: string;
    guestCount: number;
    total: number;
    openedAt: Date;
    elapsedMinutes: number;
  }[];
  voidedBills: {
    id: number;
    orderNo: string;
    location: string;
    total: number;
    closedAt: Date | null;
  }[];
};

type Numeric = number | string | { toString(): string };

export type FBDashboardOrder = {
  id: number;
  orderNo: string;
  status: FBOrderStatus;
  serviceType: FBOrderServiceType;
  paymentMethod: PaymentMethod | null;
  total: Numeric;
  guestCount: number;
  openedAt: Date;
  closedAt: Date | null;
  table: { number: string } | null;
  tableNo: string | null;
  chargedFolio: { reservation: { room: { number: string } | null } } | null;
  items: {
    menuItemId: number;
    menuItem: { name: string };
    quantity: number;
    amount: Numeric;
  }[];
};

export type FBDashboardKitchenOrder = {
  status: FBOrderStatus;
  kitchenStartedAt: Date | null;
  kitchenReadyAt: Date | null;
};

/** Strings are calendar dates; Date values are instants interpreted in WIB. */
export function resolveFBDashboardDate(date?: string | Date, now: Date = new Date()) {
  const resolvedDate = typeof date === "string" && isValidISODateOnly(date)
    ? date
    : hotelTodayISO(date instanceof Date && Number.isFinite(date.getTime()) ? date : now);
  // Use a whole-second reference: hotelOffsetMs currently loses milliseconds
  // through Intl.formatToParts and would otherwise shift the query boundaries.
  const reference = new Date(`${resolvedDate}T00:00:00.000Z`);
  return { date: resolvedDate, ...hotelTodayTimestampRange(reference) };
}

function orderLocation(order: FBDashboardOrder): string {
  const tableNumber = order.table?.number || order.tableNo;
  if (tableNumber) return `Meja ${tableNumber}`;
  const roomNumber = order.chargedFolio?.reservation.room?.number;
  return roomNumber ? `Kamar ${roomNumber}` : "—";
}

/** Read-only aggregation of stored bill snapshots, not a billing calculator. */
export function computeFBDashboardMetrics(
  orders: readonly FBDashboardOrder[],
  kitchenOrders: readonly FBDashboardKitchenOrder[],
  date?: string | Date,
  now: Date = new Date(),
): FBDashboardMetrics {
  const day = resolveFBDashboardDate(date, now);
  const inDay = (at: Date | null) => at !== null && at >= day.start && at < day.end;
  const salesByService: FBDashboardMetrics["salesByService"] = ["DINE_IN", "ROOM_SERVICE"]
    .map((serviceType) => ({ serviceType, count: 0, total: 0 }));
  const salesByTender: FBDashboardMetrics["salesByTender"] = ["CASH", "TRANSFER", "CARD", "CHARGE_TO_ROOM"]
    .map((paymentMethod) => ({ paymentMethod, count: 0, total: 0 }));
  const topItems = new Map<number, FBDashboardMetrics["topItems"][number]>();
  const result: FBDashboardMetrics = {
    date: day.date,
    settledCount: 0,
    grossSales: 0,
    averageBill: 0,
    covers: 0,
    openBillCount: 0,
    openBillTotal: 0,
    // FBOrder has no complimentary classification. Neither null tender nor a
    // zero total is evidence of a complimentary bill.
    complimentaryCount: 0,
    complimentaryTotal: 0,
    kitchenAverageMinutes: null,
    kitchenCompletedCount: 0,
    salesByService,
    salesByTender,
    topItems: [],
    openBills: [],
    voidedBills: [],
  };

  for (const order of orders) {
    const total = Number(order.total);
    if (order.status === "CLOSED" && inDay(order.closedAt)) {
      result.settledCount++;
      result.grossSales += total;
      result.covers += order.guestCount;
      const service = salesByService.find((bucket) => bucket.serviceType === order.serviceType)!;
      service.count++;
      service.total += total;
      const paymentMethod = order.paymentMethod ?? "UNKNOWN";
      let tender = salesByTender.find((bucket) => bucket.paymentMethod === paymentMethod);
      if (!tender) {
        tender = { paymentMethod, count: 0, total: 0 };
        salesByTender.push(tender);
      }
      tender.count++;
      tender.total += total;
      for (const item of order.items) {
        const aggregate = topItems.get(item.menuItemId) ?? {
          menuItemId: item.menuItemId, name: item.menuItem.name, quantity: 0, revenue: 0,
        };
        aggregate.quantity += item.quantity;
        aggregate.revenue += Number(item.amount);
        topItems.set(item.menuItemId, aggregate);
      }
    } else if ((order.status === "OPEN" || order.status === "BILLED") && inDay(order.openedAt)) {
      result.openBillCount++;
      result.openBillTotal += total;
      result.openBills.push({
        id: order.id,
        orderNo: order.orderNo,
        location: orderLocation(order),
        guestCount: order.guestCount,
        total,
        openedAt: order.openedAt,
        elapsedMinutes: Math.max(0, Math.floor((now.getTime() - order.openedAt.getTime()) / 60_000)),
      });
    } else if (order.status === "VOIDED" && inDay(order.closedAt)) {
      result.voidedBills.push({
        id: order.id, orderNo: order.orderNo, location: orderLocation(order), total, closedAt: order.closedAt,
      });
    }
  }

  let kitchenMinutes = 0;
  for (const order of kitchenOrders) {
    if (order.status === "VOIDED" || !order.kitchenStartedAt || !order.kitchenReadyAt || !inDay(order.kitchenReadyAt)) continue;
    const minutes = (order.kitchenReadyAt.getTime() - order.kitchenStartedAt.getTime()) / 60_000;
    if (!Number.isFinite(minutes) || minutes < 0) continue;
    kitchenMinutes += minutes;
    result.kitchenCompletedCount++;
  }
  result.averageBill = result.settledCount ? result.grossSales / result.settledCount : 0;
  result.kitchenAverageMinutes = result.kitchenCompletedCount ? kitchenMinutes / result.kitchenCompletedCount : null;
  result.topItems = [...topItems.values()].sort((a, b) =>
    b.quantity - a.quantity || b.revenue - a.revenue || a.menuItemId - b.menuItemId,
  );
  result.openBills.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime() || a.id - b.id);
  return result;
}

const orderSelect = {
  id: true,
  orderNo: true,
  status: true,
  serviceType: true,
  paymentMethod: true,
  total: true,
  guestCount: true,
  openedAt: true,
  closedAt: true,
  tableNo: true,
  table: { select: { number: true } },
  chargedFolio: { select: { reservation: { select: { room: { select: { number: true } } } } } },
  items: { select: { menuItemId: true, quantity: true, amount: true, menuItem: { select: { name: true } } } },
} satisfies Prisma.FBOrderSelect;

/** Server-side only; callers own authentication and F&B capability checks. */
export async function getFBDashboardMetrics(date?: string | Date, now: Date = new Date()): Promise<FBDashboardMetrics> {
  const { prisma } = await import("@/lib/prisma");
  const day = resolveFBDashboardDate(date, now);
  const withinDay = { gte: day.start, lt: day.end };
  const [orders, kitchenOrders] = await Promise.all([
    prisma.fBOrder.findMany({
      where: {
        OR: [
          { status: "CLOSED", closedAt: withinDay },
          { status: { in: ["OPEN", "BILLED"] }, openedAt: withinDay },
          { status: "VOIDED", closedAt: withinDay },
        ],
      },
      select: orderSelect,
      orderBy: [{ openedAt: "asc" }, { id: "asc" }],
    }),
    // Completion belongs to the ready day, regardless of when the bill closes.
    prisma.fBOrder.findMany({
      where: {
        status: { not: "VOIDED" },
        kitchenStartedAt: { not: null },
        kitchenReadyAt: withinDay,
      },
      select: { status: true, kitchenStartedAt: true, kitchenReadyAt: true },
    }),
  ]);
  return computeFBDashboardMetrics(orders, kitchenOrders, day.date, now);
}
