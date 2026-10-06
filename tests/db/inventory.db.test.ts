import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getStockLedger,
  receiveStock,
  recordStockTake,
  recordWastage,
  toggle86MenuItem,
} from "@/lib/fb/inventory-actions";
import { prisma } from "@/lib/prisma";
import {
  createIngredient,
  createMenuItem,
  createUser,
  resetTestDatabase,
} from "./fixtures";

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetTestDatabase();
  user = await createUser();
  process.env.TEST_AUTH_ROLE = "FB";
});

afterAll(async () => {
  await prisma.$disconnect();
});

function expectQuantity(actual: Prisma.Decimal | number, expected: string) {
  expect(new Prisma.Decimal(actual).equals(expected)).toBe(true);
  expect(new Prisma.Decimal(actual).toFixed(3)).toBe(expected);
}

describe("inventory transactions", () => {
  it("creates ingredients with defaults, overrides, and an optional menu relation", async () => {
    const ingredient = await createIngredient();
    const menu = await createMenuItem();
    const linked = await createIngredient({ menuItemId: menu.id, onHand: "0.125" });

    expect(ingredient).toMatchObject({
      category: "Bahan Basah", unit: "kg", location: "Kitchen", menuItemId: null,
    });
    expectQuantity(ingredient.onHand, "10.000");
    expectQuantity(ingredient.parLevel, "5.000");
    expect(linked.name).not.toBe(ingredient.name);
    expect(linked.menuItemId).toBe(menu.id);
    expectQuantity(linked.onHand, "0.125");
  });

  it.each([undefined, "Pengiriman pagi"])("receives exact stock with notes %s", async (notes) => {
    const ingredient = await createIngredient({ onHand: "0.100" });

    expect(await receiveStock({ ingredientId: ingredient.id, quantity: 0.201, notes }))
      .toEqual({ success: true });

    const updated = await prisma.fBIngredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    const rows = await prisma.fBStockLedger.findMany();
    expectQuantity(updated.onHand, "0.301");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ingredientId: ingredient.id, type: "RECEIVE", notes: notes ?? null, recordedById: user.id,
    });
    expectQuantity(rows[0].quantityDelta, "0.201");
    expectQuantity(rows[0].balanceAfter, "0.301");
  });

  it.each([
    { count: 12.345, delta: "2.345", balance: "12.345" },
    { count: 8.765, delta: "-1.235", balance: "8.765" },
    { count: 10, delta: "0.000", balance: "10.000" },
    { count: 0, delta: "-10.000", balance: "0.000" },
  ])("records a physical count of $count with signed delta $delta", async ({ count, delta, balance }) => {
    const ingredient = await createIngredient();
    const startedAt = Date.now();

    expect(await recordStockTake({
      ingredientId: ingredient.id, countedQuantity: count, notes: "Hitung fisik",
    })).toEqual({ success: true });
    const finishedAt = Date.now();

    const updated = await prisma.fBIngredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expectQuantity(updated.onHand, balance);
    expect(updated.lastCountedAt).not.toBeNull();
    expect(updated.lastCountedAt!.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(updated.lastCountedAt!.getTime()).toBeLessThanOrEqual(finishedAt);
    const rows = await prisma.fBStockLedger.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ingredientId: ingredient.id, type: "STOCK_TAKE", notes: "Hitung fisik", recordedById: user.id,
    });
    expectQuantity(rows[0].quantityDelta, delta);
    expectQuantity(rows[0].balanceAfter, balance);
  });

  it("records wastage with a negative delta and exact remaining balance", async () => {
    const ingredient = await createIngredient();

    expect(await recordWastage({
      ingredientId: ingredient.id, quantity: 1.235, notes: "Bahan rusak",
    })).toEqual({ success: true });

    const updated = await prisma.fBIngredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expectQuantity(updated.onHand, "8.765");
    const rows = await prisma.fBStockLedger.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ingredientId: ingredient.id, type: "WASTAGE", notes: "Bahan rusak", recordedById: user.id,
    });
    expectQuantity(rows[0].quantityDelta, "-1.235");
    expectQuantity(rows[0].balanceAfter, "8.765");
  });

  it("86 disables the linked menu and stays disabled on repeated requests", async () => {
    const menu = await createMenuItem();
    const ingredient = await createIngredient({ menuItemId: menu.id });
    expect(menu.isActive).toBe(true);

    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await toggle86MenuItem(menu.id)).toEqual({ success: true });
      expect(await prisma.menuItem.findUniqueOrThrow({ where: { id: menu.id } }))
        .toMatchObject({ isActive: false });
    }
    expectQuantity((await prisma.fBIngredient.findUniqueOrThrow({
      where: { id: ingredient.id },
    })).onHand, "10.000");
    expect(await prisma.fBStockLedger.count()).toBe(0);
  });
});

describe("stock ledger history", () => {
  it("returns only the requested ingredient, newest first with ID tie-breaking and serialized fields", async () => {
    const ingredient = await createIngredient();
    const other = await createIngredient();
    const newer = new Date("2026-08-06T08:00:00.000Z");
    const older = new Date("2026-08-05T08:00:00.000Z");
    const first = await prisma.fBStockLedger.create({ data: {
      ingredientId: ingredient.id, type: "RECEIVE", quantityDelta: "0.201",
      balanceAfter: "10.201", notes: "Pengiriman", recordedById: user.id, createdAt: newer,
    } });
    // Insert an older entry later so descending ID alone cannot satisfy the test.
    const old = await prisma.fBStockLedger.create({ data: {
      ingredientId: ingredient.id, type: "STOCK_TAKE", quantityDelta: "0.000",
      balanceAfter: "10.000", recordedById: user.id, createdAt: older,
    } });
    const last = await prisma.fBStockLedger.create({ data: {
      ingredientId: ingredient.id, type: "WASTAGE", quantityDelta: "-0.125",
      balanceAfter: "10.076", notes: "Rusak", recordedById: user.id, createdAt: newer,
    } });
    await prisma.fBStockLedger.create({ data: {
      ingredientId: other.id, type: "RECEIVE", quantityDelta: "1.000",
      balanceAfter: "11.000", recordedById: user.id, createdAt: newer,
    } });

    const result = await getStockLedger(ingredient.id);
    expect(result).toEqual({ movements: [last, first, old].map((row) => ({
      id: row.id, type: row.type, quantityDelta: row.quantityDelta.toNumber(),
      balanceAfter: row.balanceAfter.toNumber(), notes: row.notes,
      createdAt: row.createdAt.toISOString(), recordedBy: user.fullName,
    })) });
    if (!("movements" in result)) throw new Error("Expected stock history");
    expectQuantity(result.movements[0].quantityDelta, "-0.125");
    expectQuantity(result.movements[0].balanceAfter, "10.076");
  });
});

describe("inventory authorization", () => {
  it.each(["FO", "HK", "ACC"])("rejects every inventory action for %s without changes", async (role) => {
    const ingredient = await createIngredient();
    const menu = await createMenuItem();
    process.env.TEST_AUTH_ROLE = role;
    const forbidden = { error: "Anda tidak memiliki akses untuk mengelola persediaan." };

    expect(await receiveStock({ ingredientId: ingredient.id, quantity: 1 })).toEqual(forbidden);
    expect(await recordStockTake({ ingredientId: ingredient.id, countedQuantity: 5 })).toEqual(forbidden);
    expect(await recordWastage({ ingredientId: ingredient.id, quantity: 1 })).toEqual(forbidden);
    expect(await toggle86MenuItem(menu.id)).toEqual(forbidden);
    expect(await getStockLedger(ingredient.id)).toEqual(forbidden);

    const updated = await prisma.fBIngredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expectQuantity(updated.onHand, "10.000");
    expect(updated.lastCountedAt).toBeNull();
    expect(await prisma.fBStockLedger.count()).toBe(0);
    expect(await prisma.menuItem.findUniqueOrThrow({ where: { id: menu.id } }))
      .toMatchObject({ isActive: true });
  });

  it.each(["FB", "ADMIN"])("allows all inventory actions for %s", async (role) => {
    const ingredient = await createIngredient();
    const menu = await createMenuItem();
    process.env.TEST_AUTH_ROLE = role;

    expect(await receiveStock({ ingredientId: ingredient.id, quantity: 0.125 })).toEqual({ success: true });
    expect(await recordStockTake({ ingredientId: ingredient.id, countedQuantity: 9.875 })).toEqual({ success: true });
    expect(await recordWastage({ ingredientId: ingredient.id, quantity: 0.125 })).toEqual({ success: true });
    expect(await toggle86MenuItem(menu.id)).toEqual({ success: true });
    const result = await getStockLedger(ingredient.id);
    if (!("movements" in result)) throw new Error("Expected authorized stock history");
    expect(result.movements).toHaveLength(3);
    expectQuantity((await prisma.fBIngredient.findUniqueOrThrow({
      where: { id: ingredient.id },
    })).onHand, "9.750");
  });
});

describe("inventory rollback", () => {
  const movements = [
    { name: "receive", run: (ingredientId: number) => receiveStock({ ingredientId, quantity: 1.125 }) },
    { name: "stock take", run: (ingredientId: number) => recordStockTake({ ingredientId, countedQuantity: 8.875 }) },
    { name: "wastage", run: (ingredientId: number) => recordWastage({ ingredientId, quantity: 1.125 }) },
  ];

  it.each(movements)("rejects $name for a missing ingredient without orphan rows", async ({ run }) => {
    const ingredient = await createIngredient();
    await prisma.fBIngredient.delete({ where: { id: ingredient.id } });

    expect(await run(ingredient.id)).toEqual({ error: "Bahan tidak ditemukan." });
    expect(await prisma.fBStockLedger.count()).toBe(0);
    expect(await prisma.fBIngredient.count()).toBe(0);
  });

  it.each(movements)("rolls back $name when the ledger actor foreign key fails", async ({ run }) => {
    const ingredient = await createIngredient({ lastCountedAt: new Date("2026-08-01T00:00:00.000Z") });
    // Keep the authenticated ID but remove its row: ledger insertion fails after the stock update.
    await prisma.user.delete({ where: { id: user.id } });

    expect(await run(ingredient.id)).toEqual({
      error: "Status penyimpanan perubahan stok belum dapat dipastikan. Periksa dan cocokkan riwayat stok sebelum mengirim ulang agar tidak tercatat dua kali.",
      uncertain: true,
    });

    const updated = await prisma.fBIngredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expectQuantity(updated.onHand, "10.000");
    expect(updated.lastCountedAt).toEqual(ingredient.lastCountedAt);
    expect(updated.updatedAt).toEqual(ingredient.updatedAt);
    expect(await prisma.fBStockLedger.count()).toBe(0);
  });
});
