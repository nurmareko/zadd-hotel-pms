import {
  ArticleType,
  FBOrderStatus,
  PaymentMethod,
  PaymentPurpose,
  ReservationStatus,
  RoomStatus,
  TableLocation,
  TableStatus,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chargeOrderToRoom,
  payOrderDirect,
  voidOrder,
} from "@/app/app/fb/orders/[orderId]/actions";
import { confirmBill } from "@/app/app/fb/orders/[orderId]/bill/actions";
import { computeFBOrderTotals, type FBOrderTotals } from "@/lib/fb-order-totals";
import { createOrder } from "@/lib/fb-orders/actions";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import {
  createArticle,
  createFBArticle,
  createFBOrderItem,
  createFolio,
  createFolioLine,
  createGuest,
  createHotelSettings,
  createMenuItem,
  createReservationFixture,
  createRestaurantTable,
  createRoom,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const FROZEN_NOW = new Date("2026-08-05T05:00:00.000Z");
let user: Awaited<ReturnType<typeof createUser>>;
let settings: Awaited<ReturnType<typeof createHotelSettings>>;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

beforeEach(async () => {
  vi.setSystemTime(FROZEN_NOW);
  vi.clearAllMocks();
  await resetTestDatabase();
  user = await createUser();
  process.env.TEST_AUTH_ROLE = "FB";
  settings = await createHotelSettings({
    serviceChargePercent: 7.5,
    taxPercent: 11,
  });
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

function expectTotals(actual: FBOrderTotals, expected: FBOrderTotals) {
  for (const key of ["subtotal", "serviceCharge", "tax", "total"] as const) {
    expect(actual[key].equals(expected[key]), key).toBe(true);
    expect(actual[key].isInteger(), key).toBe(true);
  }
}

async function createOpenOrder() {
  const table = await createRestaurantTable({
    tableNumber: "T1",
    capacity: 4,
    location: TableLocation.INDOOR,
    status: TableStatus.AVAILABLE,
  });

  // The shared setup mocks redirect, so verify creation through persisted state.
  await createOrder({ tableId: table.id, guestCount: 2 });
  const orders = await prisma.fBOrder.findMany({ where: { tableId: table.id } });
  expect(orders).toHaveLength(1);
  const order = orders[0];
  expect(order).toMatchObject({
    status: FBOrderStatus.OPEN,
    tableId: table.id,
    tableNo: table.number,
    guestCount: 2,
    waitedById: user.id,
    closedAt: null,
  });
  expect(redirect).toHaveBeenCalledWith(`/app/fb/orders/${order.id}`);
  expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
    .toMatchObject({ status: TableStatus.OCCUPIED });


  const menuA = await createMenuItem({
    name: "Menu A",
    price: 10_003,
    category: "Makanan",
    isAvailable: true,
  });
  const menuB = await createMenuItem({
    name: "Menu B",
    price: 7_007,
    category: "Makanan",
    isAvailable: true,
  });
  const itemA = await createFBOrderItem({
    fbOrderId: order.id,
    menuItemId: menuA.id,
    quantity: 2,
    unitPrice: menuA.price,
    amount: menuA.price.mul(2),
    notes: "Tanpa sambal",
  });
  const itemB = await createFBOrderItem({
    fbOrderId: order.id,
    menuItemId: menuB.id,
    quantity: 1,
    unitPrice: menuB.price,
    amount: menuB.price,
    notes: null,
  });
  const selectedItems = [itemA, itemB].map((item) => ({
    orderItemId: item.id,
    quantity: item.quantity,
  }));
  return { order, table, itemA, itemB, selectedItems };
}

async function createBilledOrder() {
  const fixture = await createOpenOrder();
  expect(await confirmBill({ orderId: fixture.order.id })).toEqual({ ok: true });
  const billed = await prisma.fBOrder.findUniqueOrThrow({
    where: { id: fixture.order.id },
  });
  const totals = computeFBOrderTotals([fixture.itemA, fixture.itemB], settings);
  expect(billed.status).toBe(FBOrderStatus.BILLED);
  expectTotals(billed, totals);
  return { ...fixture, totals };
}

async function createInHouseFolio() {
  const guest = await createGuest();
  const roomType = await createRoomType();
  const room = await createRoom(roomType.id, RoomStatus.OC);
  const { reservation, nights } = await createReservationFixture({
    userId: user.id,
    guestId: guest.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    status: ReservationStatus.CHECKED_IN,
    nightlyRates: [100_000],
  });
  const folio = await createFolio(reservation.id);
  const article = await createArticle({ code: "ROOM", type: ArticleType.ROOM });
  const stayLine = await createFolioLine({
    folioId: folio.id,
    articleId: article.id,
    postedById: user.id,
    reservationNightId: nights[0].id,
    amount: 100_000,
  });
  const fbArticle = await createFBArticle();
  return { room, folio, stayLine, fbArticle };
}

// Compare complete persisted rows, not only counts: rejected actions must not
// move split items, alter totals/status, or leave payments/folio charges behind.
async function settlementState() {
  const [orders, items, payments, folioLines, tables] = await Promise.all([
    prisma.fBOrder.findMany({ orderBy: { id: "asc" } }),
    prisma.fBOrderItem.findMany({ orderBy: { id: "asc" } }),
    prisma.payment.findMany({ orderBy: { id: "asc" } }),
    prisma.folioLineItem.findMany({ orderBy: { id: "asc" } }),
    prisma.restaurantTable.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { orders, items, payments, folioLines, tables };
}

describe("F&B order settlement", () => {
  it.each([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER])(
    "settles %s with canonical whole-IDR totals and releases the table",
    async (method) => {
      const { order, table, selectedItems, totals } = await createBilledOrder();
      const amountTendered = totals.total.toNumber() + 5_000;
      const result = await payOrderDirect({
        orderId: order.id,
        method,
        selectedItems,
        ...(method === PaymentMethod.CASH
          ? { amountTendered }
          : { reference: "REF-265" }),
      });
      expect(result).toMatchObject({
        ok: true,
        paymentMethod: method,
        receiptOrderId: order.id,
        paidTotal: totals.total.toFixed(0),
        fullyPaid: true,
      });
      if (method === PaymentMethod.CASH) {
        expect(result).toMatchObject({ amountTendered: String(amountTendered), change: "5000" });
      }

      const closed = await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(closed).toMatchObject({
        status: FBOrderStatus.CLOSED,
        paymentMethod: method,
        chargedFolioId: null,
        closedAt: FROZEN_NOW,
      });
      expectTotals(closed, totals);
      const payments = await prisma.payment.findMany();
      expect(payments).toHaveLength(1);
      expect(payments[0]).toMatchObject({
        fbOrderId: order.id,
        folioId: null,
        method,
        purpose: PaymentPurpose.PAYMENT,
        receivedById: user.id,
        receivedAt: FROZEN_NOW,
        reference: method === PaymentMethod.CASH
          ? `CASH_TENDERED=${amountTendered};CHANGE=5000`
          : "REF-265",
      });
      expect(payments[0].amount.equals(totals.total)).toBe(true);
      expect(payments[0].amount.isInteger()).toBe(true);
      expect(await prisma.folioLineItem.count()).toBe(0);
      expect(await prisma.fBOrder.count()).toBe(1);
      expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .toMatchObject({ status: TableStatus.AVAILABLE });
    },
  );

  it("rejects unsupported QRIS without writing settlement state", async () => {
    const { order, selectedItems } = await createBilledOrder();
    const before = await settlementState();
    // QRIS is not currently a PaymentMethod or an accepted direct-payment value.
    expect(await payOrderDirect({ orderId: order.id, method: "QRIS", selectedItems }))
      .toMatchObject({ ok: false, error: expect.any(String) });
    expect(await settlementState()).toEqual(before);
  });

  it("splits A qty 2 into a closed receipt, retains B qty 1 on the billed parent, then releases the table on final payment", async () => {
    const { order, table, itemA, itemB } = await createBilledOrder();
    const aTotals = computeFBOrderTotals([itemA], settings);
    const bTotals = computeFBOrderTotals([itemB], settings);
    const first = await payOrderDirect({
      orderId: order.id,
      method: PaymentMethod.CARD,
      selectedItems: [{ orderItemId: itemA.id, quantity: 2 }],
    });
    expect(first).toMatchObject({ ok: true, fullyPaid: false, paidTotal: aTotals.total.toFixed(0) });
    if (!first.ok) throw new Error(first.error);
    expect(first.receiptOrderId).not.toBe(order.id);
    const child = await prisma.fBOrder.findUniqueOrThrow({
      where: { id: first.receiptOrderId },
      include: { items: true, payments: true },
    });
    expect(child).toMatchObject({
      status: FBOrderStatus.CLOSED,
      paymentMethod: PaymentMethod.CARD,
      tableId: null,
      tableNo: table.number,
      closedAt: FROZEN_NOW,
    });
    expectTotals(child, aTotals);
    expect(child.items).toHaveLength(1);
    expect(child.items[0]).toMatchObject({
      fbOrderId: child.id,
      menuItemId: itemA.menuItemId,
      quantity: 2,
      unitPrice: itemA.unitPrice,
      amount: itemA.amount,
      notes: itemA.notes,
    });
    expect(child.payments).toHaveLength(1);
    expect(child.payments[0]).toMatchObject({ fbOrderId: child.id, folioId: null, method: PaymentMethod.CARD });
    expect(child.payments[0].amount.equals(aTotals.total)).toBe(true);
    expect(child.payments[0].amount.isInteger()).toBe(true);

    const parent = await prisma.fBOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
    expect(parent).toMatchObject({ status: FBOrderStatus.BILLED, closedAt: null, paymentMethod: null });
    expect(parent.items).toEqual([itemB]);
    expect(parent.payments).toHaveLength(0);
    expectTotals(parent, bTotals);
    expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
      .toMatchObject({ status: TableStatus.OCCUPIED });

    expect(await payOrderDirect({
      orderId: order.id,
      method: PaymentMethod.CASH,
      amountTendered: bTotals.total.toNumber(),
      selectedItems: [{ orderItemId: itemB.id, quantity: 1 }],
    })).toMatchObject({
      ok: true,
      fullyPaid: true,
      receiptOrderId: order.id,
      paidTotal: bTotals.total.toFixed(0),
      change: "0",
    });
    const closedParent = await prisma.fBOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
    expect(closedParent).toMatchObject({ status: FBOrderStatus.CLOSED, closedAt: FROZEN_NOW, paymentMethod: PaymentMethod.CASH });
    expect(closedParent.items).toEqual([itemB]);
    expectTotals(closedParent, bTotals);
    expect(closedParent.payments).toHaveLength(1);
    expect(closedParent.payments[0]).toMatchObject({ fbOrderId: order.id, folioId: null, method: PaymentMethod.CASH });
    expect(closedParent.payments[0].amount.equals(bTotals.total)).toBe(true);
    expect(closedParent.payments[0].amount.isInteger()).toBe(true);
    expect(await prisma.fBOrder.findUniqueOrThrow({
      where: { id: child.id }, include: { items: true, payments: true },
    })).toEqual(child);
    expect(await prisma.fBOrder.count()).toBe(2);
    expect(await prisma.payment.count()).toBe(2);
    expect(await prisma.folioLineItem.count()).toBe(0);
    expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
      .toMatchObject({ status: TableStatus.AVAILABLE });
  });

  it("posts the inclusive order total to the room folio without taxing F&B again", async () => {
    const { room, folio, stayLine, fbArticle } = await createInHouseFolio();
    const { order, table, selectedItems, totals } = await createBilledOrder();
    expect(await chargeOrderToRoom({ orderId: order.id, roomNumber: room.number, selectedItems }))
      .toMatchObject({
        ok: true,
        fullyPaid: true,
        receiptOrderId: order.id,
        folioId: folio.id,
        paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
        paidTotal: totals.total.toFixed(0),
      });
    const closed = await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(closed).toMatchObject({
      status: FBOrderStatus.CLOSED,
      paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
      chargedFolioId: folio.id,
      closedAt: FROZEN_NOW,
    });
    expectTotals(closed, totals);
    const lines = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id }, include: { article: true }, orderBy: { id: "asc" },
    });
    expect(lines).toHaveLength(2);
    const fbLines = lines.filter((line) => line.fbOrderId === order.id);
    expect(fbLines).toHaveLength(1);
    expect(fbLines[0]).toMatchObject({
      folioId: folio.id,
      fbOrderId: order.id,
      articleId: fbArticle.id,
      postedById: user.id,
      postedAt: FROZEN_NOW,
    });
    expect(fbLines[0].quantity.toNumber()).toBe(1);
    expect(fbLines[0].unitPrice.equals(totals.total)).toBe(true);
    expect(fbLines[0].amount.equals(totals.total)).toBe(true);
    expect(fbLines[0].amount.isInteger()).toBe(true);
    expect(await prisma.payment.count()).toBe(0);
    const stayTotals = computeFolioTotals(lines.filter((line) => line.id === stayLine.id), [], settings);
    const folioTotals = computeFolioTotals(lines, [], settings);
    expect(stayTotals).toMatchObject({ subtotal: 100_000, serviceCharge: 7_500, tax: 11_825 });
    expect(folioTotals).toEqual({
      ...stayTotals,
      inclusiveCharges: totals.total.toNumber(),
      totalCharges: stayTotals.totalCharges + totals.total.toNumber(),
      balance: stayTotals.balance + totals.total.toNumber(),
    });
    expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
      .toMatchObject({ status: TableStatus.AVAILABLE });
  });

  it("voids an open order, releases its table, and rejects payment and room charging without writes", async () => {
    const { room } = await createInHouseFolio();
    const { order, table, selectedItems, itemA, itemB } = await createOpenOrder();
    expect(await voidOrder({ orderId: order.id, reason: "Tamu membatalkan pesanan" })).toEqual({ ok: true });
    const voided = await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: { orderBy: { id: "asc" } } } });
    expect(voided).toMatchObject({ status: FBOrderStatus.VOIDED, closedAt: FROZEN_NOW, paymentMethod: null, chargedFolioId: null });
    expect(voided.items).toEqual([itemA, itemB]);
    expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
      .toMatchObject({ status: TableStatus.AVAILABLE });
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.folioLineItem.count({ where: { fbOrderId: order.id } })).toBe(0);
    const before = await settlementState();
    expect(await payOrderDirect({ orderId: order.id, method: PaymentMethod.CASH, amountTendered: 100_000, selectedItems }))
      .toEqual({ ok: false, error: "Pesanan yang dibatalkan tidak dapat dibayar." });
    expect(await settlementState()).toEqual(before);
    expect(await chargeOrderToRoom({ orderId: order.id, roomNumber: room.number, selectedItems }))
      .toEqual({ ok: false, error: "Pesanan yang dibatalkan tidak dapat dibebankan ke kamar." });
    expect(await settlementState()).toEqual(before);
  });

  it("rolls back a split and its totals when cash tender is insufficient", async () => {
    const { order, itemA } = await createBilledOrder();
    const before = await settlementState();
    expect(await payOrderDirect({
      orderId: order.id,
      method: PaymentMethod.CASH,
      amountTendered: 1,
      selectedItems: [{ orderItemId: itemA.id, quantity: 2 }],
    })).toEqual({ ok: false, error: "Uang diterima kurang dari total tagihan" });
    expect(await settlementState()).toEqual(before);
  });
});
