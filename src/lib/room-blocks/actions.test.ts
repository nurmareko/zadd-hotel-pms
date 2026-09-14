import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createRoomBlockAction, releaseRoomBlockAction } from "./actions";

const input = { roomId: 10, startDate: "2026-09-14", endDate: "2026-09-17", reason: "MAINTENANCE" };
function transactionClient() {
  const block = { id: 1, roomId: 10, startDate: new Date(input.startDate), endDate: new Date(input.endDate), reason: "MAINTENANCE", status: "ACTIVE" };
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 10 }]),
    room: { findUnique: vi.fn().mockResolvedValue({ id: 10, number: "101", roomTypeId: 2, status: "VC" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roomType: { findUnique: vi.fn().mockResolvedValue({ name: "Standar", _count: { rooms: 2 } }) },
    reservation: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    cleaningSession: { findFirst: vi.fn().mockResolvedValue(null) },
    roomBlock: { create: vi.fn().mockResolvedValue(block), findMany: vi.fn().mockResolvedValue([block]), findUnique: vi.fn().mockResolvedValue(block), findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    housekeepingLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
  };
}
let tx: ReturnType<typeof transactionClient>;
beforeEach(() => {
  vi.resetAllMocks();

  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T05:00:00Z"));
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "FO" } });
  tx = transactionClient();
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
});

afterEach(() => vi.useRealTimers());

describe("room block actions and atomic operations", () => {
  it.each(["create", "release"])("requires FO or ADMIN for %s", async (kind) => {
    const run = () => kind === "create" ? createRoomBlockAction(input) : releaseRoomBlockAction({ blockId: 1 });
    mocks.auth.mockResolvedValueOnce(null);
    expect(await run()).toMatchObject({ ok: false, code: "SESSION_EXPIRED" });
    mocks.auth.mockResolvedValueOnce({ user: { id: "7", role: "HK" } });
    expect(await run()).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects invalid dates before opening a transaction", async () => {
    expect(await createRoomBlockAction({ ...input, startDate: "2026-02-30" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("creates today's block with OOO and an HK audit in the serializable transaction", async () => {
    expect(await createRoomBlockAction(input)).toEqual({ ok: true, blockId: 1, roomId: 10 });
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "Serializable" });
    expect(tx.room.updateMany.mock.calls[0][0].data).toEqual({ status: "OOO" });
    expect(tx.housekeepingLog.create.mock.calls[0][0].data).toMatchObject({ oldStatus: "VC", newStatus: "OOO", updatedById: 7 });
    expect(tx.roomBlock.create.mock.calls[0][0].data.createdById).toBe(7);
  });
  it.each([
    { startDate: "2026-09-15", endDate: "2026-09-17" },
    { startDate: "2026-09-12", endDate: "2026-09-14" },
  ])("does not change room status for a non-current block %j", async (range) => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "7", role: "ADMIN" } });
    expect(await createRoomBlockAction({ ...input, ...range })).toMatchObject({ ok: true });
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });
  it("rejects assigned reservation conflicts before insertion", async () => {
    tx.reservation.findMany.mockResolvedValueOnce([{ id: 4, reservationNo: "RSV-004" }]);
    expect(await createRoomBlockAction(input)).toMatchObject({ ok: false, code: "RESERVATION_CONFLICT", error: expect.stringContaining("RSV-004") });
    expect(tx.roomBlock.create).not.toHaveBeenCalled();
  });
  it("throws out of the transaction if the proposed block consumes unallocated capacity", async () => {
    tx.roomType.findUnique.mockResolvedValueOnce({ name: "Standar", _count: { rooms: 1 } });
    tx.reservation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ arrivalDate: new Date(input.startDate), departureDate: new Date(input.endDate) }]);
    expect(await createRoomBlockAction(input)).toMatchObject({ ok: false, code: "CAPACITY_CONFLICT" });
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    // The action only receives this failure via a thrown callback, not a committed false result.
    expect(tx.roomBlock.create).toHaveBeenCalledOnce();
  });
  it("releases the last current block to VD and logs exactly one transition", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", roomTypeId: 2, status: "OOO" });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: true, alreadyReleased: false });
    expect(tx.roomBlock.updateMany.mock.calls[0][0]).toEqual({ where: { id: 1, roomId: 10, status: "ACTIVE" }, data: { status: "RELEASED" } });
    expect(tx.housekeepingLog.create.mock.calls[0][0].data).toMatchObject({ oldStatus: "OOO", newStatus: "VD" });
  });
  it("preserves OOO while another current block remains", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, roomTypeId: 2, status: "OOO" });
    tx.roomBlock.findFirst.mockResolvedValueOnce({ id: 2 });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: true });
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });
  it("is idempotent when already released and does not dirty a non-OOO room", async () => {
    tx.roomBlock.findUnique.mockResolvedValue({ id: 1, roomId: 10, status: "RELEASED" });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: true, alreadyReleased: true });
    expect(tx.roomBlock.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });
  it("rechecks after a serialization retry", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "6" });
    mocks.transaction.mockRejectedValueOnce(conflict);
    tx.reservation.findMany.mockResolvedValueOnce([{ id: 4, reservationNo: "RSV-004" }]);
    expect(await createRoomBlockAction(input)).toMatchObject({ ok: false, code: "RESERVATION_CONFLICT" });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
  it("bounds retries and reports a controlled conflict", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "6" }));
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: false, code: "CONCURRENT_CHANGE" });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
  it("rolls back when the conditional release loses its state", async () => {
    tx.roomBlock.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: false, code: "CONCURRENT_CHANGE" });
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });
  it("rejects unfinished cleaning before setting today's room OOO", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", roomTypeId: 2, status: "VD" });
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 9 });
    expect(await createRoomBlockAction(input)).toMatchObject({
      ok: false,
      code: "CLEANING_IN_PROGRESS",
      error: "Pembersihan kamar sedang berjalan. Selesaikan dari daftar kerja housekeeper terlebih dahulu.",
    });
    expect(tx.cleaningSession.findFirst).toHaveBeenCalledWith({
      where: { roomId: 10, startedAt: { not: null }, finishedAt: null },
      select: { id: true },
    });
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each(["2026-09-13", "2026-09-14", "2026-09-18"])(
    "rejects CHECKED_IN occupancy departing %s independently of block overlap",
    async (departureDate) => {
      tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", roomTypeId: 2, status: "OC" });
      // The dated conflict query deliberately returns no match; physical occupancy is separate.
      tx.reservation.findFirst.mockResolvedValue({ id: 4, departureDate: new Date(departureDate) });
      expect(await createRoomBlockAction(input)).toMatchObject({ ok: false, code: "ROOM_OCCUPIED" });
      expect(tx.reservation.findFirst).toHaveBeenCalledWith({
        where: { roomId: 10, status: "CHECKED_IN" },
        select: { id: true },
      });
      expect(tx.room.updateMany).not.toHaveBeenCalled();
      expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );
  it("does not let unfinished cleaning or current occupancy prevent future scheduling", async () => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 9 });
    tx.reservation.findFirst.mockResolvedValue({ id: 4 });
    expect(await createRoomBlockAction({ ...input, startDate: "2026-09-15" })).toMatchObject({ ok: true });
    expect(tx.cleaningSession.findFirst).not.toHaveBeenCalled();
    expect(tx.reservation.findFirst).not.toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
  it("releasing an unrelated future block preserves current OOO without an HK log", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, roomTypeId: 2, status: "OOO" });
    tx.roomBlock.findUnique.mockResolvedValue({ id: 1, roomId: 10, status: "ACTIVE", startDate: new Date("2026-09-15"), endDate: new Date("2026-09-17") });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: true, alreadyReleased: false });
    expect(tx.roomBlock.updateMany).toHaveBeenCalledOnce();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });
  it.each(["2026-09-13", "2026-09-14"])(
    "releases an expired block ending %s to VD when unoccupied and no current block remains",
    async (endDate) => {
      tx.room.findUnique.mockResolvedValue({ id: 10, roomTypeId: 2, status: "OOO" });
      tx.roomBlock.findUnique.mockResolvedValue({ id: 1, roomId: 10, status: "ACTIVE", startDate: new Date("2026-09-12"), endDate: new Date(endDate) });
      expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: true });
      expect(tx.room.updateMany).toHaveBeenCalledWith({ where: { id: 10, status: "OOO" }, data: { status: "VD" } });
      expect(tx.housekeepingLog.create).toHaveBeenCalledOnce();
    },
  );
  it("rejects release's OOO-to-VD transition while a guest remains CHECKED_IN", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, roomTypeId: 2, status: "OOO" });
    tx.reservation.findFirst.mockResolvedValue({ id: 4, departureDate: new Date("2026-09-14") });
    expect(await releaseRoomBlockAction({ blockId: 1 })).toMatchObject({ ok: false, code: "ROOM_OCCUPIED" });
    expect(tx.reservation.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, status: "CHECKED_IN" }, select: { id: true } });
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rechecks unfinished cleaning after a serialization conflict", async () => {
    mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "6" }));
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 9 });
    expect(await createRoomBlockAction(input)).toMatchObject({ ok: false, code: "CLEANING_IN_PROGRESS" });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
  it("does not report a failed mutation after a committed revalidation failure", async () => {
    mocks.revalidate.mockImplementation(() => { throw new Error("cache unavailable"); });
    expect(await createRoomBlockAction(input)).toMatchObject({ ok: true });
  });
});
