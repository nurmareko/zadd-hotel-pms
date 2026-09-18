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
  tx.room.findUnique.mockResolvedValue({ status: RoomStatus.VD });
  tx.room.updateMany.mockResolvedValue({ count: 1 });
  tx.housekeepingAssignment.findFirst.mockResolvedValue({ id: 20 });
  tx.housekeepingAssignment.findUnique.mockResolvedValue(null);
  tx.housekeepingAssignment.create.mockResolvedValue({ id: 20 });
  tx.cleaningSession.findFirst.mockResolvedValue(null);
  tx.cleaningSession.updateMany.mockResolvedValue({ count: 1 });
  tx.reservation.findFirst.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

function conflict(code = "P2034") {
  return new Prisma.PrismaClientKnownRequestError("conflict", { code, clientVersion: "6.19.3" });
}

describe("complete cleaning operations", () => {
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
    expect(await operation(finish)).toEqual({ ok: false, error: "Kamar ini bukan tugas Anda" });
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
    expect(await finishCleaningOperation(finish)).toEqual({ ok: false, error: "Tidak ada sesi pembersihan aktif" });
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

  it("rejects inactive or role-revoked operators in the transaction", async () => {
    tx.user.findFirst.mockResolvedValue(null);
    expect(await startCleaningOperation(input)).toEqual({ ok: false, error: "Tidak berwenang" });
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: { id: 7, isActive: true, roles: { some: { role: { code: "HK" } } } }, select: { id: true } });
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
  it("keeps manually overridden VCU rooms inspectable without inventing a session", async () => {
    expect(await inspectRoomOperation({ ...input, passed: true })).toEqual({ ok: true });
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
  it("never steals another operator's assignment", async () => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 20, housekeeperId: 8 });
    expect((await claimAvailableRoomOperation(input)).ok).toBe(false);
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
  it.each(["HK", "ADMIN"] as const)("allows active %s self-claim with the relevant DB role", async (role) => {
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
    expect(await claimAvailableRoomOperation(input)).toEqual({ ok: false, error: "Kamar sudah ditugaskan ke petugas lain. Daftar diperbarui." });
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
    expect(await reportFloorLostFoundOperation({ ...input, description: "Dompet" })).toEqual({ ok: false, error: "Kamar tidak ditemukan" });
    expect(tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
  it.each([" a ", "x".repeat(501)])("rejects invalid trimmed description length", async (description) => {
    expect((await reportFloorLostFoundOperation({ ...input, roomId: null, description })).ok).toBe(false);
    expect(tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
});
