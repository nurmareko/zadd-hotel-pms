import { Prisma, RoomStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, tx } = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn() },
    room: { findUnique: vi.fn(), updateMany: vi.fn() },
    housekeepingAssignment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    cleaningSession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    housekeepingLog: { create: vi.fn() },
    housekeepingNotification: { upsert: vi.fn() },
    reservation: { findFirst: vi.fn() },
    lostFoundItem: { create: vi.fn() },
    fBIngredient: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    fBStockLedger: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction }, TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 } }));

import {
  claimAvailableRoomOperation, finishCleaningOperation, inspectRoomOperation,
  reportFloorLostFoundOperation, startCleaningOperation,
} from "./cleaning-operations";

const input = { roomId: 10, userId: 7, role: "HK" as const };
const finish = { ...input, linenChanged: true, towelChanged: true };
const now = new Date("2026-09-17T18:30:00Z");
const today = new Date("2026-09-18T00:00:00Z");
let rejectedTransactions: unknown[];

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  rejectedTransactions = [];
  transaction.mockImplementation(async (operation: (client: typeof tx) => Promise<unknown>) => {
    try { return await operation(tx); }
    catch (error) { rejectedTransactions.push(error); throw error; }
  });
  tx.$queryRaw.mockResolvedValue([{ id: 10 }]);
  tx.user.findFirst.mockResolvedValue({ id: 7 });
  tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VD, number: "301" });
  tx.room.updateMany.mockResolvedValue({ count: 1 });
  tx.housekeepingAssignment.findFirst.mockResolvedValue({ id: 20 });
  tx.housekeepingAssignment.findUnique.mockResolvedValue(null);
  tx.housekeepingAssignment.create.mockResolvedValue({ id: 20 });
  tx.cleaningSession.findFirst.mockResolvedValue(null);
  tx.cleaningSession.updateMany.mockResolvedValue({ count: 1 });
  tx.reservation.findFirst.mockResolvedValue(null);
  tx.fBIngredient.findMany.mockResolvedValue([]);
  tx.fBIngredient.findUnique.mockResolvedValue(null);
  tx.fBIngredient.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

function conflict(code = "P2034") {
  return new Prisma.PrismaClientKnownRequestError("conflict", { code, clientVersion: "6.19.3" });
}

describe("complete cleaning operations", () => {
  it.each(["ADMIN", "GM"] as const)("keeps assignment and session ownership mandatory for %s", async (role) => {
    tx.housekeepingAssignment.findFirst.mockResolvedValue(null);
    expect(await startCleaningOperation({ ...input, role })).toEqual({ ok: false, error: "This room is not assigned to you" });
    expect(await finishCleaningOperation({ ...finish, role })).toEqual({ ok: false, error: "This room is not assigned to you" });
    tx.housekeepingAssignment.findFirst.mockResolvedValue({ id: 20 });
    expect(await finishCleaningOperation({ ...finish, role })).toEqual({ ok: false, error: "There is no active cleaning session" });
    expect(tx.cleaningSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { roomId: 10, housekeeperId: 7, startedAt: { not: null }, finishedAt: null } }));
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.cleaningSession.create).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "GM"] as const)("allows %s to start and finish their own assigned cleaning", async (role) => {
    expect(await startCleaningOperation({ ...input, role })).toEqual({ ok: true });
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect(await finishCleaningOperation({ ...finish, role })).toEqual({ ok: true });
    expect(tx.cleaningSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 30, roomId: 10, housekeeperId: 7, startedAt: { not: null }, finishedAt: null } }));
  });
  it("locks first, samples WIB today after the lock, starts and notifies in one serializable transaction", async () => {
    tx.$queryRaw.mockImplementation(async () => { vi.setSystemTime(now); return [{ id: 10 }]; });
    vi.setSystemTime(new Date("2026-09-17T16:59:59Z"));
    expect(await startCleaningOperation(input)).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.room.findUnique.mock.invocationCallOrder[0]);
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain('SELECT id FROM "room" WHERE id = ? FOR UPDATE');
    expect(tx.housekeepingAssignment.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, date: today, housekeeperId: 7 }, select: { id: true } });
    expect(tx.cleaningSession.create).toHaveBeenCalledWith({ data: { roomId: 10, housekeeperId: 7, date: today, startedAt: now } });
    expect(tx.housekeepingNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { assignmentId: 20, recipientId: 7, status: "IN_PROGRESS" }, update: {} }));
  });

  it.each([startCleaningOperation, finishCleaningOperation])("requires today's own assignment", async (operation) => {
    tx.housekeepingAssignment.findFirst.mockResolvedValue(null);
    expect(await operation(finish)).toEqual({ ok: false, error: "This room is not assigned to you" });
    expect(tx.cleaningSession.create).not.toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });

  it("blocks an open session from any date or operator", async () => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect((await startCleaningOperation(input)).ok).toBe(false);
    expect(tx.cleaningSession.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, startedAt: { not: null }, finishedAt: null }, select: { id: true } });
    expect(tx.cleaningSession.create).not.toHaveBeenCalled();
  });

  it.each([RoomStatus.VC, RoomStatus.OC, RoomStatus.VCU, RoomStatus.OOO])("cannot start or finish %s", async (status) => {
    tx.room.findUnique.mockResolvedValue({ status });
    expect((await startCleaningOperation(input)).ok).toBe(false);
    expect((await finishCleaningOperation(finish)).ok).toBe(false);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });

  it.each([[false, true], [true, false], [false, false]])("VD requires both linen=%s and towel=%s", async (linenChanged, towelChanged) => {
    expect((await finishCleaningOperation({ ...input, linenChanged, towelChanged })).ok).toBe(false);
    expect(tx.cleaningSession.updateMany).not.toHaveBeenCalled();
  });

  it("requires the same user's open session, including sessions spanning midnight", async () => {
    expect(await finishCleaningOperation(finish)).toEqual({ ok: false, error: "There is no active cleaning session" });
    expect(tx.cleaningSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { roomId: 10, housekeeperId: 7, startedAt: { not: null }, finishedAt: null } }));
  });

  it.each([[RoomStatus.VD, RoomStatus.VCU, true], [RoomStatus.OD, RoomStatus.OC, false]] as const)("finishes %s to %s with session, audit and COMPLETED notification", async (status, nextStatus, linen) => {
    tx.room.findUnique.mockResolvedValue({ status });
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect(await finishCleaningOperation({ ...input, linenChanged: linen, towelChanged: linen, note: "Selesai" })).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.cleaningSession.updateMany).toHaveBeenCalledWith({ where: { id: 30, roomId: 10, housekeeperId: 7, startedAt: { not: null }, finishedAt: null }, data: { finishedAt: now } });
    expect(tx.room.updateMany).toHaveBeenCalledWith({ where: { id: 10, status }, data: { status: nextStatus } });
    expect(tx.housekeepingLog.create).toHaveBeenCalledWith({ data: { roomId: 10, oldStatus: status, newStatus: nextStatus, updatedById: 7, updatedAt: now, note: "Selesai", linenChanged: linen, towelChanged: linen } });
    expect(tx.housekeepingNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { assignmentId: 20, recipientId: 7, status: "COMPLETED" } }));
  });

  it.each(["session", "room", "notification"])("rejects the transaction rather than committing partial writes on %s failure", async (failure) => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    if (failure === "session") tx.cleaningSession.updateMany.mockResolvedValue({ count: 0 });
    if (failure === "room") tx.room.updateMany.mockResolvedValue({ count: 0 });
    if (failure === "notification") tx.housekeepingNotification.upsert.mockRejectedValue(new Error("offline"));
    expect((await finishCleaningOperation(finish)).ok).toBe(false);
    expect(rejectedTransactions).toHaveLength(1);
    if (failure !== "notification") expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });

  it.each(["HK", "ADMIN", "GM"] as const)("rejects inactive or role-revoked %s operators in the transaction", async (role) => {
    tx.user.findFirst.mockResolvedValue(null);
    expect(await startCleaningOperation({ ...input, role })).toEqual({ ok: false, error: "Not authorized" });
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: { id: 7, isActive: true, roles: { some: { role: { code: role } } } }, select: { id: true } });
    expect(tx.cleaningSession.create).not.toHaveBeenCalled();
  });

  it("retries P2034 with fresh reads and a fresh lock", async () => {
    tx.housekeepingNotification.upsert.mockRejectedValueOnce(conflict());
    expect(await startCleaningOperation(input)).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.housekeepingAssignment.findFirst).toHaveBeenCalledTimes(2);
  });

  it("bounds serialization retries to three attempts", async () => {
    tx.$queryRaw.mockRejectedValue(conflict());
    expect((await startCleaningOperation(input)).ok).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry P2028 or unknown failures", async () => {
    tx.$queryRaw.mockRejectedValue(conflict("P2028"));
    expect((await startCleaningOperation(input)).ok).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe("Issue300 finish-cleaning amenity consumption", () => {
  const shampoo = { id: 42, name: "Shampoo", category: "Amenities", onHand: new Prisma.Decimal("10.125") };
  const withAmenities = { ...finish, amenities: { shampoo: 2 } };

  beforeEach(() => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    tx.fBIngredient.findMany.mockResolvedValue([shampoo]);
    tx.fBIngredient.findUnique.mockResolvedValue(shampoo);
  });

  function stockWrites() {
    return [...tx.fBIngredient.update.mock.calls, ...tx.fBIngredient.updateMany.mock.calls];
  }

  it("deducts Decimal stock and records consumption with room number, operator and finish time", async () => {
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
    expect(stockWrites()).toHaveLength(1);
    expect(stockWrites()[0][0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({ id: shampoo.id }),
      data: expect.objectContaining({ onHand: new Prisma.Decimal("8.125") }),
    }));
    expect(tx.fBStockLedger.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({
      ingredientId: shampoo.id,
      type: "CONSUMPTION",
      quantityDelta: new Prisma.Decimal(-2),
      balanceAfter: new Prisma.Decimal("8.125"),
      notes: expect.stringContaining("Room 301"),
      recordedById: input.userId,
      createdAt: now,
    }) });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.room.findUnique).toHaveBeenCalledWith({ where: { id: input.roomId }, select: { status: true, number: true } });
    expect(tx.cleaningSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { finishedAt: now } }));
  });

  it("uses the authoritative balance re-read after the ingredient lock, not the discovery balance", async () => {
    tx.fBIngredient.findUnique.mockResolvedValue({ ...shampoo, onHand: new Prisma.Decimal("3.375") });
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls[1][0].join("?")).toMatch(/fb_ingredient[\s\S]*FOR UPDATE/);
    expect(tx.$queryRaw.mock.calls[1].slice(1)).toContain(shampoo.id);
    expect(tx.fBIngredient.findMany.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[1]);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.fBIngredient.findUnique.mock.invocationCallOrder[0]);
    expect(tx.fBIngredient.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: shampoo.id } }));
    expect(stockWrites()[0][0].data.onHand).toEqual(new Prisma.Decimal("1.375"));
    expect(tx.fBStockLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({ balanceAfter: new Prisma.Decimal("1.375") }) });
  });

  it("allows consumption to take stock below zero", async () => {
    tx.fBIngredient.findUnique.mockResolvedValue({ ...shampoo, onHand: new Prisma.Decimal("0.125") });
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
    expect(stockWrites()).toHaveLength(1);
    expect(stockWrites()[0][0].data.onHand).toEqual(new Prisma.Decimal("-1.875"));
    expect(tx.fBStockLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      quantityDelta: new Prisma.Decimal(-2), balanceAfter: new Prisma.Decimal("-1.875"),
    }) });
  });

  it.each(["discovery", "locked re-read"])("warns but finishes when the ingredient is missing at %s", async (stage) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      if (stage === "discovery") tx.fBIngredient.findMany.mockResolvedValue([]);
      else tx.fBIngredient.findUnique.mockResolvedValue(null);
      expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
      expect(warning).toHaveBeenCalled();
      expect(stockWrites()).toHaveLength(0);
      expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
      expect(tx.housekeepingNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ status: "COMPLETED" }),
      }));
    } finally {
      warning.mockRestore();
    }
  });

  it.each([null, {}, { shampoo: 0 }])("does not write stock or ledger for amenities %j", async (amenities) => {
    const request = { ...finish, amenities };
    expect(await finishCleaningOperation(request)).toEqual({ ok: true });
    expect(stockWrites()).toHaveLength(0);
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("locks matching ingredients in ascending id order rather than amenity input order", async () => {
    const soap = { ...shampoo, id: 11, name: "Soap" };
    // Model the database honoring orderBy; otherwise leave discovery deliberately unsorted.
    tx.fBIngredient.findMany.mockImplementation(async (args) => {
      const order = Array.isArray(args?.orderBy) ? args.orderBy : [args?.orderBy];
      return order.some((value: { id?: string } | undefined) => value?.id === "asc")
        ? [soap, shampoo] : [shampoo, soap];
    });
    tx.fBIngredient.findUnique.mockImplementation(async ({ where }) => where.id === soap.id ? soap : shampoo);
    const request = { ...finish, amenities: { shampoo: 2, soap: 1 } };
    expect(await finishCleaningOperation(request)).toEqual({ ok: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.$queryRaw.mock.calls.slice(1).map((call) => call[1])).toEqual([11, 42]);
    for (let index = 1; index <= 2; index++) {
      expect(tx.$queryRaw.mock.calls[index][0].join("?")).toMatch(/fb_ingredient[\s\S]*FOR UPDATE/);
      expect(tx.$queryRaw.mock.invocationCallOrder[index]).toBeLessThan(tx.fBIngredient.findUnique.mock.invocationCallOrder[index - 1]);
    }
    expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(2);
    expect(tx.fBStockLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ingredientId: 11, quantityDelta: new Prisma.Decimal(-1) }) });
    expect(tx.fBStockLedger.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ingredientId: 42, quantityDelta: new Prisma.Decimal(-2) }) });
  });

  it.each(["operator", "assignment", "status", "session", "linen", "session write", "room write"])("does not consume when the %s guard fails", async (guard) => {
    if (guard === "operator") tx.user.findFirst.mockResolvedValue(null);
    if (guard === "assignment") tx.housekeepingAssignment.findFirst.mockResolvedValue(null);
    if (guard === "status") tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VCU, number: "301" });
    if (guard === "session") tx.cleaningSession.findFirst.mockResolvedValue(null);
    if (guard === "session write") tx.cleaningSession.updateMany.mockResolvedValue({ count: 0 });
    if (guard === "room write") tx.room.updateMany.mockResolvedValue({ count: 0 });
    expect((await finishCleaningOperation({ ...withAmenities, linenChanged: guard !== "linen" })).ok).toBe(false);
    expect(stockWrites()).toHaveLength(0);
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
  });

  it("rejects a repeated finish without consuming a second time", async () => {
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
    tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VCU, number: "301" });
    tx.cleaningSession.findFirst.mockResolvedValue(null);
    expect((await finishCleaningOperation(withAmenities)).ok).toBe(false);
    expect(stockWrites()).toHaveLength(1);
    expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(1);
  });

  it.each(["40001", "40P01"])("retries raw ingredient lock conflict %s with fresh stock reads", async (code) => {
    const error = new Prisma.PrismaClientKnownRequestError("lock conflict", {
      code: "P2010", clientVersion: "6.19.3", meta: { code },
    });
    tx.$queryRaw.mockResolvedValueOnce([{ id: 10 }]).mockRejectedValueOnce(error);
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.fBIngredient.findMany).toHaveBeenCalledTimes(2);
    expect(tx.fBStockLedger.create).toHaveBeenCalledTimes(1);
  });

  it("bounds raw lock serialization retries", async () => {
    tx.$queryRaw.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("lock conflict", {
      code: "P2010", clientVersion: "6.19.3", meta: { code: "40001" },
    }));
    expect(await finishCleaningOperation(withAmenities)).toEqual({ ok: false, error: "The room is being processed. Reload the page." });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(tx.fBStockLedger.create).not.toHaveBeenCalled();
  });

  it("rejects the whole finish transaction if the consumption ledger write fails", async () => {
    const failure = new Error("ledger unavailable");
    tx.fBStockLedger.create.mockRejectedValue(failure);
    expect((await finishCleaningOperation(withAmenities)).ok).toBe(false);
    expect(rejectedTransactions).toEqual([failure]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe("inspection", () => {
  beforeEach(() => tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VCU }));
  it("requires a failure reason and VCU", async () => {
    expect((await inspectRoomOperation({ ...input, passed: false, notes: "  " })).ok).toBe(false);
    tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VC });
    expect((await inspectRoomOperation({ ...input, passed: true })).ok).toBe(false);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
  it("blocks any active session", async () => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect((await inspectRoomOperation({ ...input, passed: true })).ok).toBe(false);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
  it.each([true, false])("atomically records inspection passed=%s", async (passed) => {
    tx.cleaningSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 30 });
    expect(await inspectRoomOperation({ ...input, passed, notes: "  Periksa ulang  " })).toEqual({ ok: true });
    expect(tx.cleaningSession.updateMany).toHaveBeenCalledWith({ where: { id: 30, roomId: 10, finishedAt: { not: null }, inspectedAt: null }, data: { inspectedAt: now, inspectedById: 7 } });
    expect(tx.room.updateMany).toHaveBeenCalledWith({ where: { id: 10, status: "VCU" }, data: { status: passed ? "VC" : "VD" } });
    expect(tx.housekeepingLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ newStatus: passed ? "VC" : "VD", note: "Periksa ulang" }) }));
  });
  it.each(["HK", "ADMIN", "GM"] as const)("lets %s inspect VCU without assignment or inventing a session", async (role) => {
    tx.housekeepingAssignment.findFirst.mockResolvedValue(null);
    expect(await inspectRoomOperation({ ...input, role, passed: true })).toEqual({ ok: true });
    expect(tx.cleaningSession.updateMany).not.toHaveBeenCalled();
  });
  it("throws on a stale inspected session", async () => {
    tx.cleaningSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 30 });
    tx.cleaningSession.updateMany.mockResolvedValue({ count: 0 });
    expect((await inspectRoomOperation({ ...input, passed: true })).ok).toBe(false);
    expect(rejectedTransactions).toHaveLength(1);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
});

describe("mobile self-claim", () => {
  it.each(["HK", "ADMIN", "GM"] as const)("never lets %s steal another operator's assignment", async (role) => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 20, housekeeperId: 8 });
    expect(await claimAvailableRoomOperation({ ...input, role })).toEqual({ ok: false, error: "The room is already assigned to another staff member. The list has been refreshed." });
    expect(tx.housekeepingAssignment.create).not.toHaveBeenCalled();
    expect(tx.housekeepingNotification.upsert).not.toHaveBeenCalled();
  });
  it("same-user retry preserves notifications even when cleaning already started", async () => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 20, housekeeperId: 7 });
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect(await claimAvailableRoomOperation(input)).toEqual({ ok: true });
    expect(tx.housekeepingAssignment.create).not.toHaveBeenCalled();
    expect(tx.housekeepingNotification.upsert).not.toHaveBeenCalled();
  });
  it("rejects stale pool rows with an active session from any day", async () => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 30 });
    expect((await claimAvailableRoomOperation(input)).ok).toBe(false);
    expect(tx.housekeepingAssignment.create).not.toHaveBeenCalled();
  });
  it.each([RoomStatus.VC, RoomStatus.OC, RoomStatus.OOO])("rejects ineligible %s", async (status) => {
    tx.room.findUnique.mockResolvedValue({ status });
    if (status === RoomStatus.OOO) tx.reservation.findFirst.mockResolvedValue({ id: 1 });
    expect((await claimAvailableRoomOperation(input)).ok).toBe(false);
    expect(tx.housekeepingAssignment.create).not.toHaveBeenCalled();
  });
  it.each(["HK", "ADMIN", "GM"] as const)("allows active %s self-claim with the relevant DB role", async (role) => {
    expect(await claimAvailableRoomOperation({ ...input, role })).toEqual({ ok: true });
    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, isActive: true, roles: { some: { role: { code: role } } } } }));
    expect(tx.housekeepingAssignment.create).toHaveBeenCalledWith({ data: { roomId: 10, date: today, housekeeperId: 7 }, select: { id: true } });
    expect(tx.housekeepingNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { assignmentId: 20, recipientId: 7, status: "ASSIGNED" }, update: {} }));
  });
  it("queries only eligible arrivals/departures for actual WIB today", async () => {
    tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VC });
    tx.reservation.findFirst.mockResolvedValue({ id: 1 });
    expect(await claimAvailableRoomOperation(input)).toEqual({ ok: true });
    expect(tx.reservation.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, OR: [{ status: "CONFIRMED", arrivalDate: today }, { status: { in: ["CHECKED_IN", "CHECKED_OUT"] }, departureDate: today }] }, select: { id: true } });
  });
  it("rechecks ownership after a serialization retry instead of stealing the winning claim", async () => {
    tx.housekeepingAssignment.create.mockRejectedValueOnce(conflict());
    tx.housekeepingAssignment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 21, housekeeperId: 8 });
    expect(await claimAvailableRoomOperation(input)).toEqual({ ok: false, error: "The room is already assigned to another staff member. The list has been refreshed." });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.housekeepingAssignment.create).toHaveBeenCalledTimes(1);
    expect(tx.housekeepingNotification.upsert).not.toHaveBeenCalled();
  });
});

describe("floor lost and found", () => {
  beforeEach(() => {
    tx.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) =>
      sql.join("?").includes('AS "maximum"')
        ? [{ count: "0", maximum: "0" }]
        : [{ id: 10 }],
    );
  });

  it.each([null, 10])("logs optional room %s without assignment and attributes the operator", async (roomId) => {
    expect(await reportFloorLostFoundOperation({ ...input, roomId, description: "  Dompet hitam  " })).toEqual({ ok: true });
    expect(tx.lostFoundItem.create).toHaveBeenCalledWith({
      data: {
        referenceCode: "LF-2609-0001",
        createdAt: now,
        roomId,
        description: "Dompet hitam",
        foundById: 7,
        category: "OTHER",
      },
    });
    expect(tx.housekeepingAssignment.findFirst).not.toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
  it("checks room existence in the transaction", async () => {
    tx.room.findUnique.mockResolvedValue(null);
    expect(await reportFloorLostFoundOperation({ ...input, description: "Dompet" })).toEqual({ ok: false, error: "Room not found" });
    expect(tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
  it.each([" a ", "x".repeat(501)])("rejects invalid trimmed description length", async (description) => {
    expect((await reportFloorLostFoundOperation({ ...input, roomId: null, description })).ok).toBe(false);
    expect(tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
});
