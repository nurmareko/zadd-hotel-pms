import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, transaction, tx, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), revalidatePath: vi.fn(),
  tx: {
    user: { findFirst: vi.fn() }, room: { findMany: vi.fn() },
    housekeepingAssignment: { upsert: vi.fn(), deleteMany: vi.fn() },
    housekeepingNotification: { upsert: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction }, TRANSACTION_OPTIONS: {} }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { assignHousekeepingRooms, unassignHousekeepingRooms } from "./bulk-actions";

function form() {
  const data = new FormData();
  data.set("date", "2026-09-29");
  data.set("housekeeperId", "2");
  data.set("roomId", "10");
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(tx));
  tx.user.findFirst.mockResolvedValue({ id: 2 });
  tx.room.findMany.mockResolvedValue([{ id: 10 }]);
  tx.housekeepingAssignment.upsert.mockResolvedValue({ id: 20 });
  tx.housekeepingAssignment.deleteMany.mockResolvedValue({ count: 1 });
});

describe("bulk HK authorization", () => {
  it.each(["HK", "ADMIN", "GM"])("allows %s to assign and unassign through serializable transactions", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    expect(await assignHousekeepingRooms(form())).toEqual({ ok: true, count: 1 });
    expect(await unassignHousekeepingRooms(form())).toEqual({ ok: true, count: 1 });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 2, isActive: true, roles: { some: { role: { code: "HK" } } } }, select: { id: true },
    });
  });

  it.each([null, "FO", "FB", "ACC"])("denies %s before database access", async (role) => {
    auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    expect(await assignHousekeepingRooms(form())).toEqual({ ok: false, error: "Tidak berwenang" });
    expect(await unassignHousekeepingRooms(form())).toEqual({ ok: false, error: "Tidak berwenang" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not let GM assign inactive or non-HK staff", async () => {
    auth.mockResolvedValue({ user: { id: "7", role: "GM" } });
    tx.user.findFirst.mockResolvedValue(null);
    expect(await assignHousekeepingRooms(form())).toEqual({ ok: false, error: "Petugas HK tidak ditemukan atau tidak aktif" });
    expect(tx.housekeepingAssignment.upsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
