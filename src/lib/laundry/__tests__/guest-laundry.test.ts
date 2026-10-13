import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { createGuestLaundryOrder } from "../guest-actions";

const { auth, transaction, revalidate, businessDateOpen, tx } = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), revalidate: vi.fn(), businessDateOpen: vi.fn(),
  tx: {
    $queryRaw: vi.fn(), user: { findFirst: vi.fn() }, room: { findUnique: vi.fn() },
    reservation: { findFirst: vi.fn(), findUnique: vi.fn() }, folio: { findUnique: vi.fn() },
    article: { findMany: vi.fn() }, folioLineItem: { create: vi.fn() },
    payment: { create: vi.fn() }, activityLog: { create: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction }, TRANSACTION_OPTIONS: { maxWait: 10000, timeout: 20000 } }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/lib/night-audit", () => ({
  assertBusinessDateOpen: businessDateOpen,
  NightAuditClosedError: class extends Error {},
}));
import { NightAuditClosedError } from "@/lib/night-audit";
import { calculateGuestLaundryTotal, GuestLaundryOrderSchema } from "../guest-schema";

const items = [
  { articleId: 1, quantity: 3, unitPrice: 15000 },
  { articleId: 2, quantity: 2, unitPrice: 20000 },
];
const input = { roomId: 10, items, settlementType: "CHARGE_TO_ROOM" as const };

type Write = { kind: string; data: Record<string, unknown> };
let committed: Write[];
let pending: Write[];
const reservation = { id: 20, roomId: 10, status: "CHECKED_IN", folio: { id: 30 } };
const catalog = [
  { id: 1, code: "LND-KEMEJA", name: "Kemeja", type: "SERVICE" },
  { id: 2, code: "LND-CELANA", name: "Celana", type: "SERVICE" },
];
const conflict = () => new Prisma.PrismaClientKnownRequestError("internal conflict", { code: "P2034", clientVersion: "6.19.3" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  committed = [];
  pending = [];
  auth.mockResolvedValue({ user: { id: "7", role: "HK" } });
  tx.user.findFirst.mockResolvedValue({ id: 7 });
  tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: "OC" });
  tx.reservation.findFirst.mockResolvedValue(reservation);
  tx.reservation.findUnique.mockResolvedValue(reservation);
  tx.folio.findUnique.mockResolvedValue({ id: 30, reservationId: 20, status: "OPEN" });
  tx.article.findMany.mockResolvedValue(catalog);
  for (const [kind, mock] of [["line", tx.folioLineItem.create], ["payment", tx.payment.create], ["audit", tx.activityLog.create]] as const) {
    mock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      pending.push({ kind, data });
      return { id: pending.length };
    });
  }
  // Models the commit boundary, not PostgreSQL isolation/rollback behavior.
  transaction.mockImplementation(async (operation: (client: typeof tx) => Promise<unknown>) => {
    pending = [];
    try {
      const result = await operation(tx);
      committed.push(...pending);
      return result;
    } finally {
      pending = [];
    }
  });
});
afterEach(() => vi.restoreAllMocks());

describe("guest laundry schema and totals", () => {
  it("calculates itemized totals and supports an empty UI selection", () => {
    expect(calculateGuestLaundryTotal(items)).toBe(85000);
    expect(calculateGuestLaundryTotal([])).toBe(0);
    expect(calculateGuestLaundryTotal([{ quantity: 1, unitPrice: 0 }])).toBe(0);
  });

  it("trims notes before enforcing their length", () => {
    expect(GuestLaundryOrderSchema.parse({ ...input, notes: "  Pisahkan pakaian  " }).notes).toBe("Pisahkan pakaian");
    expect(GuestLaundryOrderSchema.safeParse({ ...input, notes: "x".repeat(256) }).success).toBe(false);
    expect(GuestLaundryOrderSchema.safeParse({ ...input, notes: `  ${"x".repeat(255)}  ` }).success).toBe(true);
  });

  it.each([0, -1, 1.5, "10", null, 2147483648])("rejects invalid room ID %s", (roomId) => {
    expect(GuestLaundryOrderSchema.safeParse({ ...input, roomId }).success).toBe(false);
  });

  it.for([
    [], [{ articleId: 0, quantity: 1, unitPrice: 1 }],
    [{ articleId: 1, quantity: 0, unitPrice: 1 }],
    [{ articleId: 1, quantity: 1.5, unitPrice: 1 }],
    [{ articleId: 1, quantity: 1000000, unitPrice: 1 }],
    [{ articleId: 1, quantity: 1, unitPrice: -1 }],
    [{ articleId: 1, quantity: 1, unitPrice: 0.5 }],
    [{ articleId: 1, quantity: 1, unitPrice: 10000000000 }],
    [{ articleId: 1, quantity: 2, unitPrice: 5000000000 }],
    [{ articleId: 1, quantity: 1, unitPrice: 6000000000 }, { articleId: 2, quantity: 1, unitPrice: 4000000000 }],
  ])("rejects invalid items or decimal overflow %#", (invalidItems) => {
    expect(GuestLaundryOrderSchema.safeParse({ ...input, items: invalidItems }).success).toBe(false);
  });

  it("accepts the exact whole-rupiah database boundary", () => {
    const boundary = [{ articleId: 1, quantity: 1, unitPrice: 9999999999 }];
    expect(GuestLaundryOrderSchema.safeParse({ ...input, items: boundary }).success).toBe(true);
    expect(calculateGuestLaundryTotal(boundary)).toBe(9999999999);
  });

  it("rejects unsafe helper arithmetic rather than rounding", () => {
    expect(() => calculateGuestLaundryTotal([{ quantity: 999999, unitPrice: 9999999999 }])).toThrow();
    expect(() => calculateGuestLaundryTotal([{ quantity: 1, unitPrice: NaN }])).toThrow();
  });

  it("requires a method for direct tender and sufficient explicit cash", () => {
    const direct = { ...input, settlementType: "DIRECT_TENDER" };
    expect(GuestLaundryOrderSchema.safeParse(direct).success).toBe(false);
    for (const cashTendered of [undefined, -1, 0.5, 84999, Number.MAX_SAFE_INTEGER + 1]) {
      expect(GuestLaundryOrderSchema.safeParse({ ...direct, paymentMethod: "CASH", cashTendered }).success).toBe(false);
    }
    expect(GuestLaundryOrderSchema.safeParse({ ...direct, paymentMethod: "CASH", cashTendered: 85000 }).success).toBe(true);
    for (const paymentMethod of ["CARD", "QRIS", "TRANSFER"]) {
      expect(GuestLaundryOrderSchema.safeParse({ ...direct, paymentMethod }).success).toBe(true);
    }
    expect(GuestLaundryOrderSchema.safeParse({ ...direct, paymentMethod: "CHARGE_TO_ROOM" }).success).toBe(false);
  });
});

describe("createGuestLaundryOrder", () => {
  it("atomically posts itemized room charges, preserves notes, and invalidates actual routes", async () => {
    expect(await createGuestLaundryOrder({ ...input, notes: `  ${"x".repeat(255)}  ` })).toEqual({ ok: true, orderTotal: 85000, change: 0 });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    const lines = committed.filter((write) => write.kind === "line");
    expect(lines).toHaveLength(2);
    expect(lines[0].data).toMatchObject({ folioId: 30, articleId: 1, description: "Laundry Tamu - Kemeja (3 pcs)", quantity: 3, postedById: 7 });
    expect(Number(lines[0].data.unitPrice)).toBe(15000);
    expect(Number(lines[0].data.amount)).toBe(45000);
    expect(lines[1].data.description).toBe("Laundry Tamu - Celana (2 pcs)");
    expect(Number(lines[1].data.amount)).toBe(40000);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(committed.find((write) => write.kind === "audit")?.data).toMatchObject({
      folioId: 30, reservationId: 20, roomId: 10, userId: 7,
      metadata: { notes: "x".repeat(255), lineItemIds: [1, 2], settlementType: "CHARGE_TO_ROOM", amount: 85000 },
    });
    for (const path of ["/app/fo/reservasi/20", "/app/hk/laundry", "/app/acc", "/app/acc/folios/30"]) {
      expect(revalidate).toHaveBeenCalledWith(path);
    }
  });

  it("locks the folio before authoritative reads and checks the business date before writes", async () => {
    await createGuestLaundryOrder(input);
    const lockIndex = tx.$queryRaw.mock.calls.findIndex((call) => call[0].join("?").includes('FROM "folio"'));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(tx.$queryRaw.mock.calls[lockIndex][0].join("?")).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.calls[lockIndex][1]).toBe(30);
    for (const read of [tx.room.findUnique, tx.reservation.findUnique, tx.folio.findUnique, tx.article.findMany]) {
      expect(read.mock.invocationCallOrder.at(-1)).toBeGreaterThan(tx.$queryRaw.mock.invocationCallOrder[lockIndex]);
    }
    expect(businessDateOpen).toHaveBeenCalledWith(tx, expect.any(Date));
    expect(businessDateOpen.mock.invocationCallOrder[0]).toBeLessThan(tx.folioLineItem.create.mock.invocationCallOrder[0]);
  });

  it.each(["CASH", "CARD", "QRIS", "TRANSFER"])("posts only the order total as a folio-owned %s payment", async (paymentMethod) => {
    expect(await createGuestLaundryOrder({ ...input, settlementType: "DIRECT_TENDER", paymentMethod, cashTendered: 100000 })).toEqual({
      ok: true, orderTotal: 85000, change: paymentMethod === "CASH" ? 15000 : 0,
    });
    const payment = committed.find((write) => write.kind === "payment")!.data;
    expect(payment).toMatchObject({
      folioId: 30, fbOrderId: null,
      method: paymentMethod === "QRIS" ? "TRANSFER" : paymentMethod,
      purpose: "PAYMENT", receivedById: 7,
      reference: paymentMethod === "QRIS" ? "QRIS - Kamar 101" : "Pembayaran Langsung Laundry - Kamar 101",
    });
    expect(committed.find((write) => write.kind === "audit")?.data).toMatchObject({
      metadata: { settlementMethod: paymentMethod },
    });
    expect(Number(payment.amount)).toBe(85000);
    expect(committed.filter((write) => write.kind === "payment")).toHaveLength(1);
  });

  it.each(["CASH", "CARD", "QRIS", "TRANSFER"])("preserves %s and trimmed notes in the payment reference", async (paymentMethod) => {
    expect((await createGuestLaundryOrder({
      ...input, settlementType: "DIRECT_TENDER", paymentMethod,
      cashTendered: 100000, notes: "  Bukti pembayaran 123  ",
    })).ok).toBe(true);
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        method: paymentMethod === "QRIS" ? "TRANSFER" : paymentMethod,
        reference: `${paymentMethod} - Bukti pembayaran 123`,
      }),
    }));
    expect(committed.find((write) => write.kind === "audit")?.data).toMatchObject({
      metadata: { settlementMethod: paymentMethod, notes: "Bukti pembayaran 123" },
    });
  });

  it("uses the QRIS room reference when notes contain only whitespace", async () => {
    expect((await createGuestLaundryOrder({
      ...input, settlementType: "DIRECT_TENDER", paymentMethod: "QRIS", notes: "   ",
    })).ok).toBe(true);
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ method: "TRANSFER", reference: "QRIS - Kamar 101" }),
    }));
  });

  it("returns zero change for exact cash and permits zero-priced laundry", async () => {
    expect(await createGuestLaundryOrder({ ...input, settlementType: "DIRECT_TENDER", paymentMethod: "CASH", cashTendered: 85000 })).toEqual({ ok: true, orderTotal: 85000, change: 0 });
    expect(await createGuestLaundryOrder({ ...input, items: [{ articleId: 1, quantity: 1, unitPrice: 0 }], settlementType: "DIRECT_TENDER", paymentMethod: "CASH", cashTendered: 0 })).toEqual({ ok: true, orderTotal: 0, change: 0 });
  });

  it.each(["ADMIN", "GM", "FO", "HK"])("allows %s", async (role) => {
    expect(can(role as AppRole, "laundry:guest-order")).toBe(true);
    auth.mockResolvedValue({ user: { id: "7", role } });
    expect((await createGuestLaundryOrder(input)).ok).toBe(true);
    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, isActive: true, roles: { some: { role: { code: role } } } } }));
  });

  it.each([null, { user: { id: "7", role: "FB" } }, { user: { id: "7", role: "ACC" } }, { user: { id: "7", role: "bogus" } }, { user: { id: "0", role: "HK" } }, { user: { id: "1.5", role: "HK" } }])("rejects unauthorized/invalid sessions %#", async (session) => {
    auth.mockResolvedValue(session);
    expect(await createGuestLaundryOrder(input)).toMatchObject({ ok: false, error: expect.any(String) });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a revoked operator inside the transaction", async () => {
    tx.user.findFirst.mockResolvedValue(null);
    expect((await createGuestLaundryOrder(input)).ok).toBe(false);
    expect(committed).toEqual([]);
  });

  it.each([null, {}, { ...input, roomId: -1 }, { ...input, items: [] }, { ...input, settlementType: "DIRECT_TENDER" }, { ...input, settlementType: "DIRECT_TENDER", paymentMethod: "CASH", cashTendered: 1 }])("rejects invalid input before opening a transaction %#", async (invalid) => {
    expect((await createGuestLaundryOrder(invalid)).ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["missing room", "vacant room", "missing reservation", "missing folio", "deleted folio", "closed folio", "checked out", "moved room", "wrong folio owner"])("rejects %s without writes", async (scenario) => {
    if (scenario === "missing room") tx.room.findUnique.mockResolvedValue(null);
    if (scenario === "vacant room") tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: "VC" });
    if (scenario === "missing reservation") tx.reservation.findFirst.mockResolvedValue(null);
    if (scenario === "missing folio") tx.reservation.findFirst.mockResolvedValue({ ...reservation, folio: null });
    if (scenario === "deleted folio") tx.folio.findUnique.mockResolvedValue(null);
    if (scenario === "closed folio") tx.folio.findUnique.mockResolvedValue({ id: 30, reservationId: 20, status: "CLOSED" });
    if (scenario === "checked out") tx.reservation.findUnique.mockResolvedValue({ ...reservation, status: "CHECKED_OUT" });
    if (scenario === "moved room") tx.reservation.findUnique.mockResolvedValue({ ...reservation, roomId: 11 });
    if (scenario === "wrong folio owner") tx.folio.findUnique.mockResolvedValue({ id: 30, reservationId: 21, status: "OPEN" });
    expect((await createGuestLaundryOrder(input)).ok).toBe(false);
    expect(tx.folioLineItem.create).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("accepts occupied dirty rooms", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: "OD" });
    expect((await createGuestLaundryOrder(input)).ok).toBe(true);
  });

  it.each(["LND-KEMEJA", "LND-CELANA", "LND-JAS", "LND-GAUN", "LND-DRYCLEAN", "LAUNDRY"])("accepts catalog SERVICE %s", async (code) => {
    tx.article.findMany.mockResolvedValue([{ ...catalog[0], code }]);
    expect((await createGuestLaundryOrder({ ...input, items: [items[0]] })).ok).toBe(true);
  });

  it.for([[], [{ ...catalog[0], type: "TAX" }, catalog[1]], [{ ...catalog[0], type: "ROOM" }, catalog[1]], [{ ...catalog[0], code: "MINIBAR" }, catalog[1]], [{ ...catalog[0], code: "LAUNDRY", type: "TAX" }, catalog[1]]])("rejects missing or unauthorized articles %#", async (articles) => {
    tx.article.findMany.mockResolvedValue(articles);
    expect((await createGuestLaundryOrder(input)).ok).toBe(false);
    expect(tx.folioLineItem.create).not.toHaveBeenCalled();
  });

  it.each(["CHARGE_TO_ROOM", "DIRECT_TENDER"])("blocks %s when Night Audit has closed the date", async (settlementType) => {
    businessDateOpen.mockRejectedValue(new NightAuditClosedError(new Date()));
    expect((await createGuestLaundryOrder({ ...input, settlementType, paymentMethod: "CARD" })).ok).toBe(false);
    expect(committed).toEqual([]);
    expect(tx.folioLineItem.create).not.toHaveBeenCalled();
  });

  it.each(["line", "payment", "audit"])("propagates a %s failure out of the atomic callback with no commit or revalidation", async (kind) => {
    const mock = kind === "line" ? tx.folioLineItem.create : kind === "payment" ? tx.payment.create : tx.activityLog.create;
    mock.mockRejectedValueOnce(new Error("secret database detail"));
    const result = await createGuestLaundryOrder({ ...input, settlementType: "DIRECT_TENDER", paymentMethod: "CARD" });
    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(committed).toEqual([]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("restarts the entire transaction on P2034, committing only the successful attempt", async () => {
    tx.payment.create.mockRejectedValueOnce(conflict());
    expect(await createGuestLaundryOrder({ ...input, settlementType: "DIRECT_TENDER", paymentMethod: "CARD" })).toEqual({ ok: true, orderTotal: 85000, change: 0 });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.reservation.findUnique).toHaveBeenCalledTimes(2);
    expect(businessDateOpen).toHaveBeenCalledTimes(2);
    expect(committed.filter((write) => write.kind === "line")).toHaveLength(2);
    expect(committed.filter((write) => write.kind === "payment")).toHaveLength(1);
  });

  it("rechecks state on retry and rejects a now-closed folio", async () => {
    tx.payment.create.mockRejectedValueOnce(conflict());
    tx.folio.findUnique.mockResolvedValueOnce({ id: 30, reservationId: 20, status: "OPEN" }).mockResolvedValueOnce({ id: 30, reservationId: 20, status: "CLOSED" });
    expect((await createGuestLaundryOrder({ ...input, settlementType: "DIRECT_TENDER", paymentMethod: "CARD" })).ok).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(committed).toEqual([]);
  });

  it("bounds persistent P2034 retries", async () => {
    transaction.mockRejectedValue(conflict());
    expect(await createGuestLaundryOrder(input)).toMatchObject({ ok: false, error: expect.stringContaining("coba lagi") });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("keeps a committed success when revalidation fails and attempts remaining paths", async () => {
    revalidate.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    expect(await createGuestLaundryOrder(input)).toEqual({ ok: true, orderTotal: 85000, change: 0 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(committed.filter((write) => write.kind === "line")).toHaveLength(2);
    expect(revalidate).toHaveBeenCalledWith("/app/acc/folios/30");
  });
});
