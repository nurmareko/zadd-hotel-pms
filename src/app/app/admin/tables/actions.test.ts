import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, revalidatePath, db, tx } = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  db: {
    restaurantTable: {
      findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    fBOrder: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: { restaurantTable: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  autoArrangeRestaurantTables,
  createRestaurantTable,
  deleteRestaurantTable,
  updateRestaurantTable,
  updateRestaurantTablePosition,
} from "./actions";

const input = {
  number: "T1", capacity: 4, location: "INDOOR", status: "AVAILABLE", notes: null,
};
const actions = [
  { name: "create", run: () => createRestaurantTable(input) },
  { name: "update", run: () => updateRestaurantTable({ ...input, id: 1 }) },
  { name: "delete", run: () => deleteRestaurantTable(1) },
  { name: "position", run: () => updateRestaurantTablePosition({ id: 1, posX: 20, posY: 20 }) },
  { name: "auto-arrange", run: () => autoArrangeRestaurantTables({ location: "INDOOR" }) },
];

function expectNoDatabaseAccess() {
  for (const method of Object.values(db.restaurantTable)) expect(method).not.toHaveBeenCalled();
  expect(db.fBOrder.count).not.toHaveBeenCalled();
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(tx.restaurantTable.findMany).not.toHaveBeenCalled();
  expect(tx.restaurantTable.update).not.toHaveBeenCalled();
}

function expectRevalidation() {
  expect(revalidatePath.mock.calls).toEqual([
    ["/app/admin/tables"], ["/app/fb"], ["/app/fb/tables"],
  ]);
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { role: "ADMIN" } });
  db.restaurantTable.findUnique.mockResolvedValue(null);
  db.restaurantTable.findFirst.mockResolvedValue(null);
  db.restaurantTable.count.mockResolvedValue(0);
  db.fBOrder.count.mockResolvedValue(0);
  db.$transaction.mockImplementation(async (run) => run(tx));
  tx.restaurantTable.findMany.mockResolvedValue([]);
});

describe.each(actions)("$name authorization and revalidation", ({ run }) => {
  it.each(["ADMIN", "GM", "FB"])("allows %s and revalidates all table screens", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    expect(await run()).toMatchObject({ ok: true });
    expect(auth).toHaveBeenCalledTimes(1);
    expectRevalidation();
  });

  it.each([null, "FO", "HK", "ACC", "UNKNOWN", "admin", ""])("rejects %s before database access", async (role) => {
    auth.mockResolvedValue(role === null ? null : { user: { role } });
    expect(await run()).toEqual({ ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." });
    expectNoDatabaseAccess();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  it.each([
    { name: "create number", run: () => createRestaurantTable({ ...input, number: "" }), field: "number" },
    { name: "create capacity", run: () => createRestaurantTable({ ...input, capacity: 0 }), field: "capacity" },
    { name: "create location", run: () => createRestaurantTable({ ...input, location: "OTHER" }), field: "location" },
    { name: "create status", run: () => createRestaurantTable({ ...input, status: "OTHER" }), field: "status" },
    { name: "create notes", run: () => createRestaurantTable({ ...input, notes: "x".repeat(501) }), field: "notes" },
    { name: "update id", run: () => updateRestaurantTable({ ...input, id: 0 }), field: "id" },
    { name: "update capacity", run: () => updateRestaurantTable({ ...input, id: 1, capacity: 1.5 }), field: "capacity" },
    { name: "delete id", run: () => deleteRestaurantTable(-1), field: "id" },
    { name: "position id", run: () => updateRestaurantTablePosition({ id: 0, posX: 0, posY: 0 }), field: "id" },
    { name: "position X", run: () => updateRestaurantTablePosition({ id: 1, posX: -1, posY: 0 }), field: "posX" },
    { name: "position Y", run: () => updateRestaurantTablePosition({ id: 1, posX: 0, posY: "bad" }), field: "posY" },
  ])("rejects invalid $name without database access", async ({ run, field }) => {
    expect(await run()).toMatchObject({ ok: false, error: expect.any(String), field });
    expectNoDatabaseAccess();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an invalid auto-arrange location", async () => {
    expect(await autoArrangeRestaurantTables({ location: "OTHER" })).toEqual({ ok: false, error: "Lokasi tidak valid" });
    expectNoDatabaseAccess();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createRestaurantTable", () => {
  it("normalizes input and assigns a grid position using the location's count", async () => {
    db.restaurantTable.count.mockResolvedValue(9);
    expect(await createRestaurantTable({ ...input, number: " T2 ", capacity: "6", location: "OUTDOOR", notes: "  Patio  ", posX: 999 })).toEqual({ ok: true });
    expect(db.restaurantTable.findUnique).toHaveBeenCalledWith({ where: { number: "T2" }, select: { id: true } });
    expect(db.restaurantTable.count).toHaveBeenCalledWith({ where: { location: "OUTDOOR" } });
    expect(db.restaurantTable.create).toHaveBeenCalledWith({ data: {
      number: "T2", capacity: 6, location: "OUTDOOR", status: "AVAILABLE", notes: "Patio", posX: 120, posY: 120,
    } });
  });

  it("rejects duplicate numbers before counting or inserting", async () => {
    db.restaurantTable.findUnique.mockResolvedValue({ id: 2 });
    expect(await createRestaurantTable(input)).toEqual({ ok: false, error: "Nomor meja sudah digunakan", field: "number" });
    expect(db.restaurantTable.count).not.toHaveBeenCalled();
    expect(db.restaurantTable.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateRestaurantTable", () => {
  it("excludes itself from duplicate checks and writes only parsed table fields", async () => {
    expect(await updateRestaurantTable({ ...input, id: "1", notes: "  ", posX: 999 })).toEqual({ ok: true });
    expect(db.restaurantTable.findFirst).toHaveBeenCalledWith({ where: { number: "T1", id: { not: 1 } }, select: { id: true } });
    expect(db.fBOrder.count).toHaveBeenCalledWith({ where: { tableId: 1, status: "OPEN" } });
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 1 }, data: input });
  });

  it("rejects a number used by another table", async () => {
    db.restaurantTable.findFirst.mockResolvedValue({ id: 2 });
    expect(await updateRestaurantTable({ ...input, id: 1 })).toEqual({ ok: false, error: "Nomor meja sudah digunakan", field: "number" });
    expect(db.fBOrder.count).not.toHaveBeenCalled();
    expect(db.restaurantTable.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["AVAILABLE", "RESERVED", "OUT_OF_SERVICE"])("rejects %s while orders are open", async (status) => {
    db.fBOrder.count.mockResolvedValue(1);
    expect(await updateRestaurantTable({ ...input, id: 1, status })).toEqual({ ok: false, error: "Meja memiliki pesanan terbuka. Status harus tetap Terisi.", field: "status" });
    expect(db.restaurantTable.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows edits that retain OCCUPIED with open orders", async () => {
    db.fBOrder.count.mockResolvedValue(2);
    expect(await updateRestaurantTable({ ...input, id: 1, status: "OCCUPIED" })).toEqual({ ok: true });
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ...input, status: "OCCUPIED" } });
  });
});

describe("deleteRestaurantTable", () => {
  it("checks all order history before deleting", async () => {
    expect(await deleteRestaurantTable(1)).toEqual({ ok: true });
    expect(db.fBOrder.count).toHaveBeenCalledWith({ where: { tableId: 1 } });
    expect(db.restaurantTable.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("rejects a table with order history", async () => {
    db.fBOrder.count.mockResolvedValue(1);
    expect(await deleteRestaurantTable(1)).toEqual({ ok: false, error: "Meja memiliki riwayat pesanan. Ubah status ke Tidak Beroperasi." });
    expect(db.restaurantTable.delete).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateRestaurantTablePosition", () => {
  it.each([
    { posX: 10.6, posY: 20.4, expected: { posX: 11, posY: 20 } },
    { posX: 9999, posY: 9999, expected: { posX: 828, posY: 488 } },
    { posX: 0, posY: 0, expected: { posX: 0, posY: 0 } },
  ])("rounds and clamps coordinates: $posX, $posY", async ({ posX, posY, expected }) => {
    expect(await updateRestaurantTablePosition({ id: 1, posX, posY })).toEqual({ ok: true });
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 1 }, data: expected });
  });
});

describe.each([
  { name: "create", run: actions[0].run, write: db.restaurantTable.create },
  { name: "update", run: actions[1].run, write: db.restaurantTable.update },
  { name: "delete", run: actions[2].run, write: db.restaurantTable.delete },
  { name: "position", run: actions[3].run, write: db.restaurantTable.update },
])("$name database errors", ({ run, write }) => {
  it.each([
    { code: "P2002", result: { ok: false, error: "Nomor meja sudah digunakan", field: "number" } },
    { code: "P2025", result: { ok: false, error: "Meja tidak ditemukan." } },
    { code: "P2003", result: { ok: false, error: "Terjadi kesalahan" } },
  ])("maps $code without revalidation", async ({ code, result }) => {
    write.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private detail", { code, clientVersion: "6" }));
    expect(await run()).toEqual(result);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hides unexpected errors without revalidation", async () => {
    write.mockRejectedValue(new Error("private connection detail"));
    expect(await run()).toEqual({ ok: false, error: "Terjadi kesalahan" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("autoArrangeRestaurantTables", () => {
  it("sorts table numbers numerically and writes positions inside the transaction", async () => {
    tx.restaurantTable.findMany.mockResolvedValue([
      { id: 10, number: "T10" }, { id: 2, number: "T2" }, { id: 1, number: "T1" },
    ]);
    db.$transaction.mockImplementation(async (run) => {
      const result = await run(tx);
      expect(revalidatePath).not.toHaveBeenCalled();
      return result;
    });
    expect(await autoArrangeRestaurantTables({ location: "PRIVATE" })).toEqual({ ok: true, tables: [
      { id: 1, posX: 20, posY: 20 }, { id: 2, posX: 120, posY: 20 }, { id: 10, posX: 220, posY: 20 },
    ] });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.restaurantTable.findMany).toHaveBeenCalledWith({ where: { location: "PRIVATE" }, select: { id: true, number: true } });
    expect(tx.restaurantTable.update.mock.calls).toEqual([
      [{ where: { id: 1 }, data: { posX: 20, posY: 20 } }],
      [{ where: { id: 2 }, data: { posX: 120, posY: 20 } }],
      [{ where: { id: 10 }, data: { posX: 220, posY: 20 } }],
    ]);
    expect(db.restaurantTable.update).not.toHaveBeenCalled();
    expectRevalidation();
  });

  it("returns an empty layout without writes for an empty location", async () => {
    expect(await autoArrangeRestaurantTables({ location: "OUTDOOR" })).toEqual({ ok: true, tables: [] });
    expect(tx.restaurantTable.update).not.toHaveBeenCalled();
    expectRevalidation();
  });

  it.each(["read", "write", "commit"])("does not invalidate after a transaction %s failure", async (stage) => {
    tx.restaurantTable.findMany.mockResolvedValue([{ id: 1, number: "T1" }]);
    const error = new Error("private transaction detail");
    if (stage === "read") tx.restaurantTable.findMany.mockRejectedValue(error);
    if (stage === "write") tx.restaurantTable.update.mockRejectedValue(error);
    if (stage === "commit") db.$transaction.mockImplementation(async (run) => {
      await run(tx);
      throw error;
    });
    expect(await autoArrangeRestaurantTables({ location: "INDOOR" })).toEqual({ ok: false, error: "Terjadi kesalahan" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
