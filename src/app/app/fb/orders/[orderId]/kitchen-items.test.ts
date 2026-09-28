import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, transaction, tx, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    fBOrder: { findUnique: vi.fn(), update: vi.fn() },
    fBOrderItem: {
      findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    menuItem: { findUnique: vi.fn() },
    hotelSettings: { findUnique: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transaction },
  TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 },
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/fb-orders/actions", () => ({
  createOrder: vi.fn(), createRoomServiceOrder: vi.fn(), lookupRoomForCharge: vi.fn(),
}));

import { addItemToOrder, removeItemFromOrder, updateItemQuantity } from "./actions";

const startedAt = new Date("2026-09-28T03:00:00Z");
const readyAt = new Date("2026-09-28T03:10:00Z");
let kitchen: { kitchenStartedAt: Date | null; kitchenReadyAt: Date | null };

function item(quantity: number) {
  return { id: 7, fbOrderId: 1, quantity, unitPrice: new Prisma.Decimal(10000) };
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "9", role: "FB" } });
  transaction.mockImplementation(async (run) => run(tx));
  kitchen = { kitchenStartedAt: startedAt, kitchenReadyAt: readyAt };
  tx.fBOrder.findUnique.mockResolvedValue({ id: 1, status: "OPEN", guestCount: 2 });
  tx.fBOrder.update.mockImplementation(async ({ data }) => {
    if ("kitchenStartedAt" in data) kitchen.kitchenStartedAt = data.kitchenStartedAt;
    if ("kitchenReadyAt" in data) kitchen.kitchenReadyAt = data.kitchenReadyAt;
    return { id: 1, ...data };
  });
  tx.fBOrderItem.findUnique.mockResolvedValue(item(2));
  tx.fBOrderItem.findFirst.mockResolvedValue(null);
  tx.fBOrderItem.findMany.mockResolvedValue([{ amount: new Prisma.Decimal(30000) }]);
  tx.menuItem.findUnique.mockResolvedValue({
    id: 3, price: new Prisma.Decimal(10000), isActive: true, name: "Nasi goreng",
  });
  tx.hotelSettings.findUnique.mockResolvedValue({ serviceChargePercent: 10, taxPercent: 11 });
});

function expectKitchenReset() {
  expect(kitchen).toEqual({ kitchenStartedAt: null, kitchenReadyAt: null });
  expect(tx.fBOrder.update).toHaveBeenCalledWith({
    where: { id: 1 },
    data: { kitchenStartedAt: null, kitchenReadyAt: null },
  });
  expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain(
    'SELECT id FROM "fb_order" WHERE id = ? FOR UPDATE',
  );
  expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
    tx.fBOrder.update.mock.invocationCallOrder[0],
  );
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(revalidatePath).toHaveBeenCalledWith("/app/fb/kitchen");
}

function expectKitchenUnchanged() {
  expect(kitchen).toEqual({ kitchenStartedAt: startedAt, kitchenReadyAt: readyAt });
  for (const [{ data }] of tx.fBOrder.update.mock.calls) {
    expect(data).not.toHaveProperty("kitchenStartedAt");
    expect(data).not.toHaveProperty("kitchenReadyAt");
  }
}

describe("kitchen state after order item changes", () => {
  it.each([false, true])("resets a ready order when adding an item (existing: %s)", async (existing) => {
    tx.fBOrderItem.findFirst.mockResolvedValue(existing ? item(2) : null);
    expect(await addItemToOrder({ orderId: 1, menuItemId: 3, quantity: 1 })).toEqual({ ok: true });
    expectKitchenReset();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.fBOrderItem.findFirst.mock.invocationCallOrder[0],
    );
    if (existing) {
      expect(tx.fBOrderItem.update).toHaveBeenCalledWith({
        where: { id: 7 }, data: { quantity: 3, amount: new Prisma.Decimal(30000) },
      });
    } else {
      expect(tx.fBOrderItem.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ quantity: 1, amount: new Prisma.Decimal(10000) }),
      }));
    }
    expect(tx.fBOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        subtotal: new Prisma.Decimal(30000), serviceCharge: new Prisma.Decimal(3000),
        tax: new Prisma.Decimal(3630), total: new Prisma.Decimal(36630),
      },
    });
  });

  it.each([readyAt, null])("resets ready/in-progress kitchen state on quantity increase (%s)", async (ready) => {
    kitchen.kitchenReadyAt = ready;
    expect(await updateItemQuantity({ orderItemId: 7, quantity: 3 })).toEqual({ ok: true });
    expectKitchenReset();
  });

  it("uses the post-lock quantity when a stale reduction is actually an increase", async () => {
    tx.fBOrderItem.findUnique.mockResolvedValueOnce(item(5)).mockResolvedValue(item(1));
    expect(await updateItemQuantity({ orderItemId: 7, quantity: 3 })).toEqual({ ok: true });
    expectKitchenReset();
    expect(tx.fBOrderItem.findUnique).toHaveBeenLastCalledWith({
      where: { id: 7 },
      select: { id: true, fbOrderId: true, quantity: true, unitPrice: true },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.fBOrderItem.findUnique.mock.invocationCallOrder[1],
    );
  });

  it.each([3, 5])("does not reset when post-lock quantity %s makes a stale increase a noop/reduction", async (current) => {
    tx.fBOrderItem.findUnique.mockResolvedValueOnce(item(1)).mockResolvedValue(item(current));
    expect(await updateItemQuantity({ orderItemId: 7, quantity: 3 })).toEqual({ ok: true });
    expectKitchenUnchanged();
  });

  it.each([0, 1, 2])("does not reset for quantity %s (deletion/reduction/noop)", async (quantity) => {
    expect(await updateItemQuantity({ orderItemId: 7, quantity })).toEqual({ ok: true });
    expectKitchenUnchanged();
  });

  it("does not reset for explicit item removal", async () => {
    expect(await removeItemFromOrder({ orderItemId: 7 })).toEqual({ ok: true });
    expectKitchenUnchanged();
  });

  it.each([null, { ...item(2), fbOrderId: 99 }])("rejects an item deleted or moved while waiting for the lock: %j", async (current) => {
    tx.fBOrderItem.findUnique.mockResolvedValueOnce(item(2)).mockResolvedValue(current);
    expect(await updateItemQuantity({ orderItemId: 7, quantity: 3 })).toEqual({
      ok: false, error: "Item pesanan tidak ditemukan.",
    });
    expect(tx.fBOrderItem.update).not.toHaveBeenCalled();
    expect(tx.fBOrder.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["add", "increase"])("does not change closed orders (%s)", async (operation) => {
    tx.fBOrder.findUnique.mockResolvedValue({ id: 1, status: "PAID", guestCount: 2 });
    const result = operation === "add"
      ? await addItemToOrder({ orderId: 1, menuItemId: 3 })
      : await updateItemQuantity({ orderItemId: 7, quantity: 3 });
    expect(result.ok).toBe(false);
    expect(tx.fBOrderItem.create).not.toHaveBeenCalled();
    expect(tx.fBOrderItem.update).not.toHaveBeenCalled();
    expect(tx.fBOrder.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
