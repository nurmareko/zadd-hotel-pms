import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, transaction, revalidatePath, tx, ledgerRead, menuUpdate } = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), revalidatePath: vi.fn(),
  ledgerRead: vi.fn(), menuUpdate: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    fBIngredient: { findUnique: vi.fn(), updateMany: vi.fn() },
    fBStockLedger: { create: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    fBStockLedger: { findMany: ledgerRead },
    menuItem: { update: menuUpdate },
  },
  TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 },
}));

import { deriveInventoryStatus } from "./inventory-types";
import { getStockLedger, receiveStock, recordStockTake, recordWastage, toggle86MenuItem } from "./inventory-actions";

const decimal = (value: number | string) => new Prisma.Decimal(value);
const conflict = (code = "P2034", meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("internal database detail", { code, clientVersion: "6.19.3", meta });
const calls = [
  () => receiveStock({ ingredientId: 1, quantity: 1 }),
  () => recordStockTake({ ingredientId: 1, countedQuantity: 1 }),
  () => recordWastage({ ingredientId: 1, quantity: 1 }),
  () => toggle86MenuItem(1),
  () => getStockLedger(1),
];

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "7", role: "FB" } });
  transaction.mockImplementation(async (run) => run(tx));
  tx.fBIngredient.findUnique.mockResolvedValue({ id: 1, onHand: decimal("0.1") });
  tx.fBIngredient.updateMany.mockResolvedValue({ count: 1 });
  ledgerRead.mockResolvedValue([]);
  menuUpdate.mockResolvedValue({ id: 1, isActive: false });
});

describe("deriveInventoryStatus", () => {
  it.each([
    [-0.001, 0, "NEGATIVE"], [-1, -2, "NEGATIVE"], [0, 0, "OUT"],
    [0, 10, "OUT"], [0.001, 1, "LOW"], [0.999, 1, "LOW"],
    [1, 1, "LOW"], [1.001, 1, "OK"], [1, 0, "OK"],
  ] as const)("classifies %s against par %s as %s", (onHand, par, expected) => {
    expect(deriveInventoryStatus(onHand, par)).toBe(expected);
  });
});

describe("inventory authorization and validation", () => {
  it.each(["FB", "ADMIN"])("allows %s for every action", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    for (const call of calls) expect(await call()).not.toHaveProperty("error");
  });

  it.each([null, "FO", "HK", "ACC", "GM", "unknown"])("rejects %s before database access", async (role) => {
    auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    for (const call of calls) expect(await call()).toHaveProperty("error");
    expect(transaction).not.toHaveBeenCalled();
    expect(menuUpdate).not.toHaveBeenCalled();
    expect(ledgerRead).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "abc", "0", "-1", "1.5", "2147483648"])("rejects invalid session actor %s", async (id) => {
    auth.mockResolvedValue({ user: { id, role: "FB" } });
    for (const call of calls) expect(await call()).toHaveProperty("error");
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, "1", null, undefined])("strictly rejects ID %s everywhere", async (id) => {
    const ingredientId = id as number;
    const results = await Promise.all([
      receiveStock({ ingredientId, quantity: 1 }), recordWastage({ ingredientId, quantity: 1 }),
      recordStockTake({ ingredientId, countedQuantity: 1 }), toggle86MenuItem(ingredientId), getStockLedger(ingredientId),
    ]);
    for (const result of results) expect(result).toHaveProperty("error");
    expect(transaction).not.toHaveBeenCalled();
    expect(menuUpdate).not.toHaveBeenCalled();
    expect(ledgerRead).not.toHaveBeenCalled();
  });

  it.each([-1, NaN, Infinity, -Infinity, 10000000, 0.0001, 1.2345, "1", null, undefined])("rejects quantity %s without rounding/coercion", async (value) => {
    const quantity = value as number;
    for (const result of await Promise.all([
      receiveStock({ ingredientId: 1, quantity }), recordWastage({ ingredientId: 1, quantity }),
      recordStockTake({ ingredientId: 1, countedQuantity: quantity }),
    ])) expect(result).toHaveProperty("error");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires positive receive/wastage but accepts a physical count of zero", async () => {
    expect(await receiveStock({ ingredientId: 1, quantity: 0 })).toHaveProperty("error");
    expect(await recordWastage({ ingredientId: 1, quantity: 0 })).toHaveProperty("error");
    expect(await recordStockTake({ ingredientId: 1, countedQuantity: 0 })).toEqual({ success: true });
  });

  it("bounds notes and normalizes blank notes to null", async () => {
    for (const result of await Promise.all([
      receiveStock({ ingredientId: 1, quantity: 1, notes: "a".repeat(256) }),
      recordStockTake({ ingredientId: 1, countedQuantity: 1, notes: "a".repeat(256) }),
      recordWastage({ ingredientId: 1, quantity: 1, notes: "a".repeat(256) }),
    ])) expect(result).toEqual({ error: expect.stringContaining("maksimal 255 karakter") });
    expect(transaction).not.toHaveBeenCalled();
    expect(await receiveStock({ ingredientId: 1, quantity: 0.001, notes: "   " })).toEqual({ success: true });
    expect(tx.fBStockLedger.create.mock.calls[0][0].data.notes).toBeNull();
  });

  it("accepts exactly 255 characters of notes for every movement", async () => {
    const notes = "a".repeat(255);
    for (const result of await Promise.all([
      receiveStock({ ingredientId: 1, quantity: 1, notes }),
      recordStockTake({ ingredientId: 1, countedQuantity: 1, notes }),
      recordWastage({ ingredientId: 1, quantity: 1, notes }),
    ])) expect(result).toEqual({ success: true });
    for (const [args] of tx.fBStockLedger.create.mock.calls) expect(args.data.notes).toBe(notes);
  });

  it.each([null, {}, { ingredientId: 1, quantity: 1, recordedById: 99 }, { ingredientId: 1, quantity: 1, notes: 9 }])("rejects malformed or extra input %j", async (input) => {
    expect(await receiveStock(input as Parameters<typeof receiveStock>[0])).toHaveProperty("error");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("atomic inventory movements", () => {
  it.each([
    ["RECEIVE", () => receiveStock({ ingredientId: 1, quantity: 0.2, notes: "Kiriman" }), "0.2", "0.3"],
    ["WASTAGE", () => recordWastage({ ingredientId: 1, quantity: 0.2 }), "-0.2", "-0.1"],
    ["STOCK_TAKE", () => recordStockTake({ ingredientId: 1, countedQuantity: 0 }), "-0.1", "0"],
    ["STOCK_TAKE", () => recordStockTake({ ingredientId: 1, countedQuantity: 0.1 }), "0", "0.1"],
  ] as const)("records %s with exact signed delta/balance", async (movementType, call, delta, balance) => {
    expect(await call()).toEqual({ success: true });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain('SELECT id FROM "fb_ingredient" WHERE id = ? FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.fBIngredient.findUnique.mock.invocationCallOrder[0]);
    expect(tx.fBIngredient.updateMany).toHaveBeenCalledWith({
      where: { id: 1, onHand: decimal("0.1") },
            data: {
              onHand: decimal(balance),
              ...(movementType === "STOCK_TAKE" ? { lastCountedAt: expect.any(Date) } : {}),
            },
    });
    expect(tx.fBStockLedger.create).toHaveBeenCalledWith({ data: {
      ingredientId: 1, type: movementType, quantityDelta: decimal(delta), balanceAfter: decimal(balance),
      recordedById: 7, notes: movementType === "RECEIVE" ? "Kiriman" : null,
    } });
    expect(revalidatePath).toHaveBeenCalledWith("/app/fb/inventory");
  });

  it("updates lastCountedAt alongside the balance inside the ledger transaction", async () => {
    transaction.mockImplementation(async (run) => {
      const before = Date.now();
      await run(tx);
      const data = tx.fBIngredient.updateMany.mock.calls[0][0].data;
      expect(data.lastCountedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(data.lastCountedAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(data.onHand.toString()).toBe("2");
      expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(1);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
    expect(await recordStockTake({ ingredientId: 1, countedQuantity: 2 })).toEqual({ success: true });
  });

  it("uses the current negative balance for a stock-take adjustment", async () => {
    tx.fBIngredient.findUnique.mockResolvedValue({ id: 1, onHand: decimal(-3) });
    expect(await recordStockTake({ ingredientId: 1, countedQuantity: 2 })).toEqual({ success: true });
    expect(tx.fBStockLedger.create.mock.calls[0][0].data.quantityDelta.toString()).toBe("5");
  });

  it("accepts the exact Decimal(10,3) maximum", async () => {
    tx.fBIngredient.findUnique.mockResolvedValue({ id: 1, onHand: decimal(0) });
    expect(await receiveStock({ ingredientId: 1, quantity: 9999999.999 })).toEqual({ success: true });
  });

  it.each([
    ["9999999.999", () => receiveStock({ ingredientId: 1, quantity: 0.001 })],
    ["-9999999.999", () => recordWastage({ ingredientId: 1, quantity: 0.001 })],
    ["-0.001", () => recordStockTake({ ingredientId: 1, countedQuantity: 9999999.999 })],
  ] as const)("rejects balance or delta overflow from %s before writes", async (onHand, call) => {
    tx.fBIngredient.findUnique.mockResolvedValue({ id: 1, onHand: decimal(onHand) });
    expect(await call()).toEqual({ error: "Saldo atau perubahan stok melebihi batas yang dapat disimpan." });
    expect(tx.fBIngredient.updateMany).not.toHaveBeenCalled();
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects missing ingredients", async () => {
    tx.fBIngredient.findUnique.mockResolvedValue(null);
    expect(await calls[0]()).toHaveProperty("error");
    expect(tx.fBIngredient.updateMany).not.toHaveBeenCalled();
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
  });

  it("aborts when the conditional update loses", async () => {
    tx.fBIngredient.updateMany.mockResolvedValue({ count: 0 });
    expect(await calls[0]()).toHaveProperty("error");
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates ledger failure out of the transaction so the balance rolls back", async () => {
    const failure = new Error("private database details");
    tx.fBStockLedger.create.mockRejectedValue(failure);
    transaction.mockImplementation(async (run) => {
      await expect(run(tx)).rejects.toBe(failure);
      throw failure;
    });
    expect(await calls[0]()).toEqual({
      error: "Status penyimpanan perubahan stok belum dapat dipastikan. Periksa dan cocokkan riwayat stok sebelum mengirim ulang agar tidak tercatat dua kali.",
      uncertain: true,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([conflict(), conflict("P2010", { code: "40001" }), conflict("P2010", { code: "40P01" })])("retries the entire operation with fresh reads", async (error) => {
    tx.fBStockLedger.create.mockRejectedValueOnce(error);
    tx.fBIngredient.findUnique
      .mockResolvedValueOnce({ id: 1, onHand: decimal(1) })
      .mockResolvedValueOnce({ id: 1, onHand: decimal(5) });
    expect(await recordStockTake({ ingredientId: 1, countedQuantity: 3 })).toEqual({ success: true });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.fBIngredient.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.fBStockLedger.create.mock.calls[1][0].data.quantityDelta.toString()).toBe("-2");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("bounds retry exhaustion and does not invalidate", async () => {
    transaction.mockRejectedValue(conflict());
    expect(await calls[0]()).toEqual({ error: "Stok berubah bersamaan. Muat ulang halaman dan coba lagi." });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not retry unrelated database failures", async () => {
    transaction.mockRejectedValue(conflict("P2003"));
    expect(await calls[0]()).toEqual({
      error: "Status penyimpanan perubahan stok belum dapat dipastikan. Periksa dan cocokkan riwayat stok sebelum mengirim ulang agar tidak tercatat dua kali.",
      uncertain: true,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["RECEIVE", () => receiveStock({ ingredientId: 1, quantity: 1 })],
    ["STOCK_TAKE", () => recordStockTake({ ingredientId: 1, countedQuantity: 1 })],
    ["WASTAGE", () => recordWastage({ ingredientId: 1, quantity: 1 })],
  ] as const)("reports an uncertain %s outcome when the commit acknowledgement is lost without retrying", async (_type, call) => {
    transaction.mockImplementation(async (run) => {
      await run(tx);
      throw new Error("connection lost while acknowledging COMMIT");
    });
    expect(await call()).toEqual({
      error: "Status penyimpanan perubahan stok belum dapat dipastikan. Periksa dan cocokkan riwayat stok sebelum mengirim ulang agar tidak tercatat dua kali.",
      uncertain: true,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.fBIngredient.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not report a committed movement as failed if cache invalidation fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      revalidatePath.mockImplementation(() => { throw new Error("cache unavailable"); });
      expect(await calls[0]()).toEqual({ success: true });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("invalidates only after commit", async () => {
    transaction.mockImplementation(async (run) => {
      const result = await run(tx);
      expect(revalidatePath).not.toHaveBeenCalled();
      return result;
    });
    expect(await calls[0]()).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
});

describe("menu 86 and ledger reads", () => {
  it("idempotently sets inactive without reading/toggling current state", async () => {
    expect(await toggle86MenuItem(1)).toEqual({ success: true });
    expect(await toggle86MenuItem(1)).toEqual({ success: true });
    for (const [args] of menuUpdate.mock.calls) expect(args).toEqual({ where: { id: 1 }, data: { isActive: false } });
    for (const path of ["/app/fb/inventory", "/app/fb/pos", "/app/fb/menu"]) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("handles a missing menu item", async () => {
    menuUpdate.mockRejectedValue(conflict("P2025"));
    expect(await toggle86MenuItem(1)).toEqual({ error: "Menu tidak ditemukan." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps the latest 100 ledger rows to the exact transport contract", async () => {
    ledgerRead.mockResolvedValue([{
      id: 4, type: "CONSUMPTION", quantityDelta: decimal("-0.001"), balanceAfter: decimal("-2.001"),
      notes: null, createdAt: new Date("2026-10-02T01:00:00Z"), recordedBy: { fullName: "Operator FB" },
    }]);
    expect(await getStockLedger(1)).toEqual({ movements: [{
      id: 4, type: "CONSUMPTION", quantityDelta: -0.001, balanceAfter: -2.001,
      notes: null, createdAt: "2026-10-02T01:00:00.000Z", recordedBy: "Operator FB",
    }] });
    expect(ledgerRead).toHaveBeenCalledWith({
      where: { ingredientId: 1 }, take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, type: true, quantityDelta: true, balanceAfter: true, notes: true, createdAt: true, recordedBy: { select: { fullName: true } } },
    });
  });

  it("returns an empty list when no history exists", async () => {
    expect(await getStockLedger(1)).toEqual({ movements: [] });
  });

  it("does not leak unexpected read/menu/auth errors", async () => {
    ledgerRead.mockRejectedValue(new Error("secret"));
    menuUpdate.mockRejectedValue(new Error("secret"));
    expect(await getStockLedger(1)).toEqual({ error: "Gagal memuat riwayat stok. Silakan coba lagi." });
    expect(await toggle86MenuItem(1)).toEqual({ error: "Gagal menonaktifkan menu. Silakan coba lagi." });
    auth.mockRejectedValue(new Error("secret"));
    for (const call of calls) {
      const result = await call();
      expect(result).toHaveProperty("error");
      expect(JSON.stringify(result)).not.toContain("secret");
    }
  });
});
