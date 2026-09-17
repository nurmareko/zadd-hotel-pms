import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), revalidatePath: vi.fn(), revalidateRoomStatusViews: vi.fn(),
  start: vi.fn(), finish: vi.fn(), inspect: vi.fn(), claim: vi.fn(), report: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/revalidate-room-status", () => ({ revalidateRoomStatusViews: mocks.revalidateRoomStatusViews }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: {} }));
vi.mock("./cleaning-operations", () => ({
  startCleaningOperation: mocks.start, finishCleaningOperation: mocks.finish,
  inspectRoomOperation: mocks.inspect, claimAvailableRoomOperation: mocks.claim,
  reportFloorLostFoundOperation: mocks.report,
}));

import { claimAvailableRoom, finishMobileCleaning, inspectMobileRoom, reportFloorLostFound, startMobileCleaning } from "@/app/app/hk/mobile/actions";
import { finishCleaning, inspectRoom, logFoundItem, startCleaning } from "@/app/app/hk/rooms/[roomId]/actions";

function form(fields: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "HK" } });
  for (const operation of [mocks.start, mocks.finish, mocks.inspect, mocks.claim, mocks.report]) {
    operation.mockResolvedValue({ ok: true });
  }
});

const mobileCalls = [
  () => startMobileCleaning(10),
  () => finishMobileCleaning(form({ roomId: "10" })),
  () => inspectMobileRoom(10, true),
  () => claimAvailableRoom(10),
  () => reportFloorLostFound(form({ description: "Dompet" })),
];

describe("mobile action boundaries", () => {
  it.each([null, { user: { id: "7", role: "FO" } }, { user: { id: "7", role: "FB" } }])("denies unauthenticated or unrelated roles on every action", async (session) => {
    mocks.auth.mockResolvedValue(session);
    for (const call of mobileCalls) expect(await call()).toEqual({ ok: false, error: "Tidak berwenang" });
    for (const operation of [mocks.start, mocks.finish, mocks.inspect, mocks.claim, mocks.report]) expect(operation).not.toHaveBeenCalled();
  });

  it.each(["NaN", "", "0", "-1", "1.5", "2147483648", "Infinity"])("rejects invalid authenticated user ID %s", async (id) => {
    mocks.auth.mockResolvedValue({ user: { id, role: "HK" } });
    for (const call of mobileCalls) expect((await call()).ok).toBe(false);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.1, Number.NaN, Infinity, 2147483648])("rejects room ID %s before operations", async (roomId) => {
    expect((await startMobileCleaning(roomId)).ok).toBe(false);
    expect((await inspectMobileRoom(roomId, true)).ok).toBe(false);
    expect((await claimAvailableRoom(roomId)).ok).toBe(false);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each(["HK", "ADMIN"])("passes authenticated %s identity, not operator fields from the form", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role } });
    await finishMobileCleaning(form({ roomId: "10", linenChanged: "on", towelChanged: "true", note: "  Bersih  ", userId: "99", role: "FO" }));
    expect(mocks.finish).toHaveBeenCalledWith({ roomId: 10, userId: 7, role, linenChanged: true, towelChanged: true, note: "Bersih" });
    expect(mocks.revalidateRoomStatusViews).toHaveBeenCalledWith({ roomId: 10 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/hk/clean");
  });

  it("validates strict boolean inspection input at runtime", async () => {
    // Simulates a forged action request despite the TypeScript signature.
    expect((await inspectMobileRoom(10, "false" as unknown as boolean)).ok).toBe(false);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it.each(["invalid", "-1", "1.5", "2147483648"])("rejects malformed form room %s", async (roomId) => {
    expect((await finishMobileCleaning(form({ roomId }))).ok).toBe(false);
    expect((await reportFloorLostFound(form({ roomId, description: "Dompet" }))).ok).toBe(false);
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("rejects arbitrary checkbox values and oversized notes", async () => {
    expect((await finishMobileCleaning(form({ roomId: "10", linenChanged: "garbage" }))).ok).toBe(false);
    expect((await finishMobileCleaning(form({ roomId: "10", note: "x".repeat(501) }))).ok).toBe(false);
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it.each(["", " a ", "x".repeat(501)])("validates description after trimming", async (description) => {
    expect((await reportFloorLostFound(form({ description }))).ok).toBe(false);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("logs public areas with omitted/blank room; room context stays optional", async () => {
    for (const fields of [{ description: "  Dompet  " }, { description: "Dompet", roomId: "" }]) {
      expect(await reportFloorLostFound(form(fields))).toEqual({ ok: true });
    }
    expect(mocks.report).toHaveBeenCalledWith({ userId: 7, role: "HK", roomId: null, description: "Dompet" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/hk/lost-found");
  });

  it("passes canonical failure through and never revalidates failed operations", async () => {
    const failure = { ok: false, error: "Kamar ini bukan tugas Anda" };
    mocks.start.mockResolvedValue(failure);
    expect(await startMobileCleaning(10)).toEqual(failure);
    expect(mocks.revalidateRoomStatusViews).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("delegates claim and inspection typed inputs to the canonical operations", async () => {
    await claimAvailableRoom(10);
    await inspectMobileRoom(10, false, "  Masih kotor  ");
    expect(mocks.claim).toHaveBeenCalledWith({ roomId: 10, userId: 7, role: "HK" });
    expect(mocks.inspect).toHaveBeenCalledWith({ roomId: 10, userId: 7, role: "HK", passed: false, notes: "Masih kotor" });
  });
});

describe("desktop delegation", () => {
  it("uses the same complete operations, never a second route-owned transaction", async () => {
    await startCleaning(form({ roomId: "10" }));
    await finishCleaning(form({ roomId: "10", linenChanged: "on", towelChanged: "on" }));
    await inspectRoom(form({ roomId: "10", passed: "true" }));
    expect(mocks.start).toHaveBeenCalledWith({ roomId: 10, userId: 7, role: "HK" });
    expect(mocks.finish).toHaveBeenCalledWith({ roomId: 10, userId: 7, role: "HK", linenChanged: true, towelChanged: true, note: null });
    expect(mocks.inspect).toHaveBeenCalledWith({ roomId: 10, userId: 7, role: "HK", passed: true, notes: null });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("retains assignment-bound desktop lost-and-found behavior", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 10 }]),
      housekeepingAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
      lostFoundItem: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation((operation) => operation(tx));
    expect(await logFoundItem(form({ roomId: "10", description: "Dompet" }))).toEqual({ ok: false, error: "Kamar ini bukan tugas Anda" });
    expect(tx.housekeepingAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { roomId: 10, housekeeperId: 7, date: expect.any(Date) } }));
    expect(tx.lostFoundItem.create).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });
});
