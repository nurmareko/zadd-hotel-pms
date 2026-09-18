import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), revalidate: vi.fn(), transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn() }, room: { findUnique: vi.fn() },
    housekeepingAssignment: { findFirst: vi.fn() },
    lostFoundItem: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 } }));

import { claimLostFoundItem, createLostFoundItem, disposeLostFoundItem } from "../actions";
import { createLostFoundItem as legacyCreate, markLostFoundItemReturned as legacyReturn } from "@/app/app/hk/lost-found/actions";
import { logFoundItem } from "@/app/app/hk/rooms/[roomId]/actions";
import { reportFloorLostFoundOperation } from "@/lib/housekeeping/cleaning-operations";

const now = new Date("2026-08-31T17:00:00Z");
function form(data: Record<string, string>) {
  const value = new FormData();
  for (const [key, entry] of Object.entries(data)) value.set(key, entry);
  return value;
}
function conflict(code: string) {
  return new Prisma.PrismaClientKnownRequestError("conflict", { code, clientVersion: "6.19.3", meta: { target: ["reference_code"] } });
}
function allocation(count: string, maximum: string) {
  mocks.tx.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => sql.join("?").includes('AS "maximum"') ? [{ count, maximum }] : [{ id: 10 }]);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "HK" } });
  mocks.transaction.mockImplementation((operation) => operation(mocks.tx));
  allocation("0", "0");
  mocks.tx.user.findFirst.mockResolvedValue({ id: 7 });
  mocks.tx.room.findUnique.mockResolvedValue({ id: 10 });
  mocks.tx.housekeepingAssignment.findFirst.mockResolvedValue({ id: 20 });
  mocks.tx.lostFoundItem.create.mockImplementation(async ({ data }) => ({ id: 1, referenceCode: data.referenceCode, roomId: data.roomId }));
  mocks.tx.lostFoundItem.findUnique.mockResolvedValue({ id: 1, referenceCode: "LF-2609-0001", roomId: 10, status: "UNCLAIMED" });
  mocks.tx.lostFoundItem.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("canonical lost-found actions", () => {
  it.each(["HK", "FO", "ADMIN"])("allows %s and records operator/default category within one transaction", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role } });
    expect(await createLostFoundItem(form({ description: "Dompet hitam", roomId: "10" }))).toEqual({ ok: true, itemId: 1, referenceCode: "LF-2609-0001" });
    expect(mocks.tx.lostFoundItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: "OTHER", referenceCode: "LF-2609-0001", createdAt: now, foundById: 7 }) }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    for (const path of ["/app/hk/lost-found", "/app/hk/mobile", "/app/hk/rooms", "/app/hk/rooms/10"]) expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });
  it.each([null, { user: { id: "7", role: "FB" } }, { user: { id: "7", role: "ACC" } }, { user: { id: "invalid", role: "HK" } }])("rejects unauthorized sessions before database access", async (session) => {
    mocks.auth.mockResolvedValue(session);
    expect((await createLostFoundItem(form({ description: "Dompet" }))).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("validates untrusted input and never revalidates failed operations", async () => {
    expect((await createLostFoundItem(form({ description: " " }))).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects an operator whose active membership changed", async () => {
    mocks.tx.user.findFirst.mockResolvedValue(null);
    expect((await createLostFoundItem(form({ description: "Dompet" }))).ok).toBe(false);
    expect(mocks.tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
  it("rejects a missing room inside the transaction", async () => {
    mocks.tx.room.findUnique.mockResolvedValue(null);
    expect(await createLostFoundItem(form({ description: "Dompet", roomId: "10" }))).toEqual({ ok: false, error: "Kamar tidak ditemukan. Pilih kamar lain atau kosongkan pilihan kamar." });
    expect(mocks.tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
  it.each([["3", "10000", "LF-2609-10001"], ["20", "5", "LF-2609-0021"]])("allocates above count %s and historical maximum %s", async (count, maximum, code) => {
    allocation(count, maximum);
    expect(await createLostFoundItem(form({ description: "Dompet" }))).toMatchObject({ ok: true, referenceCode: code });
  });
  it.each(["P2002", "P2034"])("retries the entire transaction after %s", async (code) => {
    mocks.tx.lostFoundItem.create.mockRejectedValueOnce(conflict(code));
    expect((await createLostFoundItem(form({ description: "Dompet" }))).ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.tx.user.findFirst).toHaveBeenCalledTimes(2);
  });
  it("bounds contention retries and returns an Indonesian error", async () => {
    mocks.tx.lostFoundItem.create.mockRejectedValue(conflict("P2034"));
    expect(await createLostFoundItem(form({ description: "Dompet" }))).toMatchObject({ ok: false, error: expect.stringContaining("petugas lain") });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("records claim details, timestamp and operator with a conditional write", async () => {
    expect((await claimLostFoundItem(form({ itemId: "1", claimantName: "Sari", claimantPhone: "08123456", claimantIdNumber: "001", resolution: "Identitas cocok" }))).ok).toBe(true);
    expect(mocks.tx.lostFoundItem.updateMany).toHaveBeenCalledWith({ where: { id: 1, status: "UNCLAIMED" }, data: { status: "RETURNED", returnedById: 7, returnedAt: now, claimantName: "Sari", claimantPhone: "08123456", claimantIdNumber: "001", resolution: "Identitas cocok" } });
  });
  it("combines disposal notes without overwriting return audit fields", async () => {
    expect((await disposeLostFoundItem(form({ itemId: "1", disposalReason: "Rusak", notes: "Disetujui petugas" }))).ok).toBe(true);
    expect(mocks.tx.lostFoundItem.updateMany).toHaveBeenCalledWith({ where: { id: 1, status: "UNCLAIMED" }, data: { status: "DISPOSED", disposedById: 7, disposedAt: now, disposalReason: "Rusak\nCatatan: Disetujui petugas" } });
  });
  it.each(["RETURNED", "DISPOSED"])("blocks both terminal transitions from %s", async (status) => {
    mocks.tx.lostFoundItem.findUnique.mockResolvedValue({ id: 1, status });
    expect((await claimLostFoundItem(form({ itemId: "1", claimantName: "Sari" }))).ok).toBe(false);
    expect((await disposeLostFoundItem(form({ itemId: "1", disposalReason: "Rusak" }))).ok).toBe(false);
    expect(mocks.tx.lostFoundItem.updateMany).not.toHaveBeenCalled();
  });
  it("uses pemusnahan/hibah wording for disposed-state and persistence errors", async () => {
    mocks.tx.lostFoundItem.findUnique.mockResolvedValueOnce({ id: 1, status: "DISPOSED" });
    expect(await disposeLostFoundItem(form({ itemId: "1", disposalReason: "Rusak" }))).toEqual({ ok: false, error: "Barang sudah dimusnahkan atau dihibahkan dan tidak dapat diproses lagi." });
    mocks.tx.lostFoundItem.updateMany.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await disposeLostFoundItem(form({ itemId: "1", disposalReason: "Rusak" }))).toEqual({ ok: false, error: "Gagal mencatat pemusnahan/hibah barang. Silakan coba lagi." });
  });
  it("rejects missing items and conditional-write races", async () => {
    mocks.tx.lostFoundItem.findUnique.mockResolvedValueOnce(null);
    expect(await claimLostFoundItem(form({ itemId: "1", claimantName: "Sari" }))).toEqual({ ok: false, error: "Barang temuan tidak ditemukan." });
    mocks.tx.lostFoundItem.updateMany.mockResolvedValue({ count: 0 });
    expect((await disposeLostFoundItem(form({ itemId: "1", disposalReason: "Rusak" }))).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves void native-form actions and resolution-only returns", async () => {
    expect(await legacyCreate(form({ description: "Dompet" }))).toBeUndefined();
    expect(await legacyReturn(form({ itemId: "1", resolution: "Diambil tamu" }))).toBeUndefined();
    expect(mocks.tx.lostFoundItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolution: "Diambil tamu", returnedById: 7, claimantName: null }) }));
  });
});

describe("existing room and mobile writers", () => {
  it.each([null, 10])("allocates the mobile code in the existing transaction for room %s", async (roomId) => {
    expect(await reportFloorLostFoundOperation({ userId: 7, role: "HK", roomId, description: "Dompet" })).toEqual({ ok: true });
    expect(mocks.tx.lostFoundItem.create).toHaveBeenCalledWith({ data: { referenceCode: "LF-2609-0001", createdAt: now, roomId, description: "Dompet", foundById: 7, category: "OTHER" } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.housekeepingAssignment.findFirst).not.toHaveBeenCalled();
  });
  it("preserves the room assignment guard", async () => {
    mocks.tx.housekeepingAssignment.findFirst.mockResolvedValue(null);
    expect(await logFoundItem(form({ roomId: "10", description: "Dompet" }))).toEqual({ ok: false, error: "Kamar ini bukan tugas Anda" });
    expect(mocks.tx.lostFoundItem.create).not.toHaveBeenCalled();
  });
  it.each(["room", "mobile"])("retries reference collisions in the %s writer without nesting transactions", async (writer) => {
    mocks.tx.lostFoundItem.create.mockRejectedValueOnce(conflict("P2002"));
    const result = writer === "room" ? await logFoundItem(form({ roomId: "10", description: "Dompet" })) : await reportFloorLostFoundOperation({ userId: 7, role: "HK", roomId: 10, description: "Dompet" });
    expect(result).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.tx.user.findFirst).toHaveBeenCalledTimes(2);
  });
});
