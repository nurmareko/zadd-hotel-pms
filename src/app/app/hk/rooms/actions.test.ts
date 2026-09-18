import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, transaction, tx, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    room: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    cleaningSession: { findFirst: vi.fn() },
    housekeepingAssignment: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    housekeepingNotification: { upsert: vi.fn() },
    housekeepingLog: { create: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transaction },
  TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createHousekeepingTaskNote, setRoomHousekeeper } from "./actions";
import { TASK_NOTE_CATEGORIES } from "./task-note-schema";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ roomId: "1", category: "Lainnya", note: "  Bersihkan jendela  ", ...overrides })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  auth.mockResolvedValue({ user: { id: "9", role: "HK" } });
  transaction.mockImplementation(async (run) => run(tx));
  tx.room.findUnique.mockResolvedValue({ id: 1, status: "OC" });
  tx.user.findFirst.mockResolvedValue({ id: 2 });
  tx.cleaningSession.findFirst.mockResolvedValue(null);
  tx.housekeepingAssignment.findUnique.mockResolvedValue(null);
  tx.housekeepingAssignment.upsert.mockResolvedValue({ id: 7 });
  tx.housekeepingAssignment.deleteMany.mockResolvedValue({ count: 1 });
});

describe("room board server actions", () => {
  it.each([null, "FO", "FB", "ACC"])("denies %s before database access", async (role) => {
    auth.mockResolvedValue(role ? { user: { role, id: "9" } } : null);
    expect(await setRoomHousekeeper(1, "2026-09-17", 2)).toEqual({ ok: false, error: "Tidak berwenang" });
    expect(await createHousekeepingTaskNote(form())).toEqual({ ok: false, error: "Tidak berwenang" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["HK", "ADMIN"])("allows %s to assign active HK staff", async (role) => {
    auth.mockResolvedValue({ user: { id: "9", role } });
    expect(await setRoomHousekeeper(1, "2026-09-17", 2)).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain('SELECT id FROM "room" WHERE id = ? FOR UPDATE');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.room.findUnique.mock.invocationCallOrder[0]);
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 2, isActive: true, roles: { some: { role: { code: "HK" } } } },
      select: { id: true },
    });
    expect(tx.housekeepingNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { assignmentId: 7, recipientId: 2, status: "ASSIGNED" }, update: {},
    }));
    for (const path of ["/app/hk/rooms", "/app/hk/clean", "/app/hk/rooms/1", "/app/fo/reservasi/kalender"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, "1", true, null])("rejects invalid numeric room ID %s", async (value) => {
    expect((await setRoomHousekeeper(value as number, "2026-09-17", 2)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "2", true, undefined])("rejects invalid assignee %s", async (value) => {
    expect((await setRoomHousekeeper(1, "2026-09-17", value as number)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["2026-02-29", "2026-04-31", "2026-9-17", "2026-09-17T00:00:00Z", "0000-01-01", "bad"])("rejects invalid date %s", async (date) => {
    expect((await setRoomHousekeeper(1, date, 2)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("uses a UTC date-only assignment boundary", async () => {
    await setRoomHousekeeper(1, "2028-02-29", 2);
    expect(tx.housekeepingAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { roomId: 1, date: new Date("2028-02-29T00:00:00Z"), housekeeperId: 2 },
    }));
  });

  it("rejects missing rooms without writes or revalidation", async () => {
    tx.room.findUnique.mockResolvedValue(null);
    expect((await createHousekeepingTaskNote(form())).ok).toBe(false);
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects inactive or non-HK assignees before writing the note", async () => {
    tx.user.findFirst.mockResolvedValue(null);
    expect((await createHousekeepingTaskNote(form({ housekeeperId: "2" }))).ok).toBe(false);
    expect(tx.housekeepingAssignment.upsert).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });

  it.each([null, 3])("blocks removing/changing an active cleaner to %s", async (housekeeperId) => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 7, housekeeperId: 2 });
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 4, housekeeperId: 2 });
    expect((await setRoomHousekeeper(1, "2026-09-17", housekeeperId)).ok).toBe(false);
    expect(tx.housekeepingAssignment.deleteMany).not.toHaveBeenCalled();
    expect(tx.housekeepingAssignment.upsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not reset notifications or assignment when the assignee is unchanged", async () => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 7, housekeeperId: 2 });
    expect(await setRoomHousekeeper(1, "2026-09-17", 2)).toEqual({ ok: true });
    expect(tx.housekeepingAssignment.upsert).not.toHaveBeenCalled();
    expect(tx.housekeepingNotification.upsert).not.toHaveBeenCalled();
  });

  it("unassigns only the selected room/date and is idempotent when absent", async () => {
    tx.housekeepingAssignment.findUnique.mockResolvedValue({ id: 7, housekeeperId: 2 });
    expect(await setRoomHousekeeper(1, "2026-09-17", null)).toEqual({ ok: true });
    expect(tx.housekeepingAssignment.deleteMany).toHaveBeenCalledWith({ where: { id: 7, housekeeperId: 2 } });
    tx.housekeepingAssignment.findUnique.mockResolvedValue(null);
    expect(await setRoomHousekeeper(1, "2026-09-17", null)).toEqual({ ok: true });
    expect(tx.housekeepingAssignment.deleteMany).toHaveBeenCalledTimes(1);
  });

  it.each(["1.2", "1e2", "0x10", "-1", "0", "true", " 2 "])("rejects non-decimal form IDs %s", async (roomId) => {
    expect((await createHousekeepingTaskNote(form({ roomId }))).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([{ note: "  ab  " }, { note: "x".repeat(2001) }, { category: "Other" }, { housekeeperId: "null" }])("rejects malformed task input %j", async (input) => {
    expect((await createHousekeepingTaskNote(form(input))).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects non-FormData, duplicate fields and uploaded IDs", async () => {
    expect((await createHousekeepingTaskNote(null as unknown as FormData)).ok).toBe(false);
    const duplicate = form();
    duplicate.append("roomId", "2");
    expect((await createHousekeepingTaskNote(duplicate)).ok).toBe(false);
    const upload = form();
    upload.set("housekeeperId", new Blob(["2"]));
    expect((await createHousekeepingTaskNote(upload)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(TASK_NOTE_CATEGORIES)("logs exact category %s with unchanged current status and actor", async (category) => {
    expect(await createHousekeepingTaskNote(form({ category, priority: "Tinggi" }))).toEqual({ ok: true });
    expect(tx.housekeepingLog.create).toHaveBeenCalledWith({ data: {
      roomId: 1, oldStatus: "OC", newStatus: "OC", updatedById: 9,
      updatedAt: expect.any(Date), note: `[TUGAS: ${category}] Bersihkan jendela`,
    } });
    expect(tx.housekeepingAssignment.upsert).not.toHaveBeenCalled();
  });

  it("assigns hotel-today atomically with the note, ignoring a client date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T18:00:00Z"));
    try {
      expect(await createHousekeepingTaskNote(form({ housekeeperId: "2", date: "2000-01-01" }))).toEqual({ ok: true });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(tx.housekeepingAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: { roomId: 1, housekeeperId: 2, date: new Date("2026-09-17T00:00:00Z") },
      }));
      expect(tx.housekeepingLog.create).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the assignment date and note timestamp consistent when awaits cross WIB midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T16:59:58Z"));
    const capturedNow = new Date("2026-09-16T16:59:59Z");
    tx.room.findUnique.mockImplementationOnce(async () => {
      vi.setSystemTime(capturedNow);
      return { id: 1, status: "OC" };
    });
    tx.user.findFirst.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date("2026-09-16T17:00:01Z"));
      return { id: 2 };
    });
    try {
      expect(await createHousekeepingTaskNote(form({ housekeeperId: "2" }))).toEqual({ ok: true });
      expect(tx.housekeepingAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: { roomId: 1, housekeeperId: 2, date: new Date("2026-09-16T00:00:00Z") },
      }));
      expect(tx.housekeepingLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ updatedAt: capturedNow }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("captures a fresh consistent timestamp for a transaction retry after WIB midnight", async () => {
    vi.useFakeTimers();
    const firstNow = new Date("2026-09-16T16:59:59Z");
    const retryNow = new Date("2026-09-16T17:00:01Z");
    vi.setSystemTime(firstNow);
    tx.housekeepingLog.create.mockImplementationOnce(async () => {
      vi.setSystemTime(retryNow);
      throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "6" });
    });
    try {
      expect(await createHousekeepingTaskNote(form({ housekeeperId: "2" }))).toEqual({ ok: true });
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(tx.housekeepingAssignment.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
        create: { roomId: 1, housekeeperId: 2, date: new Date("2026-09-16T00:00:00Z") },
      }));
      expect(tx.housekeepingAssignment.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
        create: { roomId: 1, housekeeperId: 2, date: new Date("2026-09-17T00:00:00Z") },
      }));
      expect(tx.housekeepingLog.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ updatedAt: firstNow }),
      });
      expect(tx.housekeepingLog.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ updatedAt: retryNow }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not save a note when its optional assignment would strand a cleaner", async () => {
    tx.cleaningSession.findFirst.mockResolvedValue({ id: 4, housekeeperId: 3 });
    expect((await createHousekeepingTaskNote(form({ housekeeperId: "2" }))).ok).toBe(false);
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });

  it("retries serialization conflicts by rerunning the complete transaction", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "6" });
    transaction.mockRejectedValueOnce(conflict);
    expect(await setRoomHousekeeper(1, "2026-09-17", 2)).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("bounds retries and does not revalidate on failure", async () => {
    transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "6" }));
    expect((await setRoomHousekeeper(1, "2026-09-17", 2)).ok).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe failure when a write throws", async () => {
    tx.housekeepingLog.create.mockRejectedValue(new Error("private database detail"));
    const result = await createHousekeepingTaskNote(form({ housekeeperId: "2" }));
    expect(result).toEqual({ ok: false, error: "Gagal menyimpan tugas kamar" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
