import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, transaction, revalidatePath, tx } = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    fBOrder: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transaction, fBOrder: tx.fBOrder },
  TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { advanceKitchenOrder } from "./actions";

const startedAt = new Date("2026-09-28T08:00:00.000Z");
const start = { orderId: 1, transition: "START", expectedKitchenStartedAt: null };
const ready = { orderId: 1, transition: "READY", expectedKitchenStartedAt: startedAt.toISOString() };
const order = {
  id: 1, status: "OPEN", kitchenStartedAt: null as Date | null,
  kitchenReadyAt: null as Date | null, items: [{ id: 2 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "1", role: "FB" } });
  transaction.mockImplementation(async (run) => run(tx));
  tx.fBOrder.findUnique.mockResolvedValue({ ...order });
  tx.fBOrder.updateMany.mockResolvedValue({ count: 1 });
});

describe("kitchen transitions", () => {
  it.each(["FB", "ADMIN", "GM"])("allows %s using the canonical order permission", async (role) => {
    auth.mockResolvedValue({ user: { id: "1", role } });
    expect(await advanceKitchenOrder(start)).toEqual({ ok: true, status: "COOKING" });
  });

  it.each([null, "FO", "HK", "ACC"])("rejects %s before reading the database", async (role) => {
    auth.mockResolvedValue(role ? { user: { role } } : null);
    expect((await advanceKitchenOrder(start)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
    expect(tx.fBOrder.findUnique).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "BILLED"])("starts and completes %s tickets without changing billing state", async (status) => {
    tx.fBOrder.findUnique.mockResolvedValue({ ...order, status });
    expect(await advanceKitchenOrder(start)).toEqual({ ok: true, status: "COOKING" });
    expect(tx.fBOrder.updateMany.mock.calls[0][0].data).toEqual({ kitchenStartedAt: expect.any(Date) });
    tx.fBOrder.findUnique.mockResolvedValue({ ...order, status, kitchenStartedAt: startedAt });
    expect(await advanceKitchenOrder(ready)).toEqual({ ok: true, status: "READY" });
    expect(tx.fBOrder.updateMany.mock.calls[1][0].data).toEqual({ kitchenReadyAt: expect.any(Date) });
  });

  it.each(["CLOSED", "VOIDED"])("rejects %s tickets", async (status) => {
    tx.fBOrder.findUnique.mockResolvedValue({ ...order, status });
    expect((await advanceKitchenOrder(start)).ok).toBe(false);
    expect(tx.fBOrder.updateMany).not.toHaveBeenCalled();
  });

  it("locks the order before reading preparation and item state", async () => {
    await advanceKitchenOrder(start);
    expect(transaction).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain('SELECT id FROM "fb_order" WHERE id = ? FOR UPDATE');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.fBOrder.findUnique.mock.invocationCallOrder[0]);
  });

  it("rejects a completion from a previous kitchen cycle", async () => {
    tx.fBOrder.findUnique.mockResolvedValue({ ...order, kitchenStartedAt: new Date("2026-09-28T09:00:00.000Z") });
    expect((await advanceKitchenOrder(ready)).ok).toBe(false);
    expect(tx.fBOrder.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { ...order, items: [] },
    { ...order, kitchenStartedAt: startedAt },
    { ...order, kitchenReadyAt: startedAt },
    null,
  ])("does not start an empty, already processed, or missing order", async (current) => {
    tx.fBOrder.findUnique.mockResolvedValue(current);
    expect((await advanceKitchenOrder(start)).ok).toBe(false);
    expect(tx.fBOrder.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { ...order },
    { ...order, kitchenStartedAt: startedAt, kitchenReadyAt: startedAt },
  ])("does not complete an unstarted or already completed order", async (current) => {
    tx.fBOrder.findUnique.mockResolvedValue(current);
    expect((await advanceKitchenOrder(ready)).ok).toBe(false);
    expect(tx.fBOrder.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { orderId: 1, transition: "READY" },
    { ...ready, expectedKitchenStartedAt: null },
    { ...start, expectedKitchenStartedAt: startedAt.toISOString() },
    { ...start, orderId: -1 },
    { ...start, transition: "INVALID" },
  ])("rejects invalid transition input before database access", async (input) => {
    expect((await advanceKitchenOrder(input)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not report success or invalidate when the conditional write loses", async () => {
    tx.fBOrder.updateMany.mockResolvedValue({ count: 0 });
    expect((await advanceKitchenOrder(start)).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("invalidates the kitchen only after commit", async () => {
    transaction.mockImplementation(async (run) => {
      const result = await run(tx);
      expect(revalidatePath).not.toHaveBeenCalled();
      return result;
    });
    await advanceKitchenOrder(start);
    expect(revalidatePath).toHaveBeenCalledWith("/app/fb/kitchen");
  });
});
