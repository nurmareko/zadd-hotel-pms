import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction }, TRANSACTION_OPTIONS: {} }));
import { updateMealPlanPrices } from "./actions";

const input = { BB: 60000, HB: 160000, FB: 260000 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { role: "ADMIN" } });
  mocks.transaction.mockImplementation(async (fn) => fn({ article: { update: mocks.update } }));
});

describe("meal-plan catalog action", () => {
  it.each(["ADMIN", "GM"])("allows %s and updates exactly the three existing articles atomically", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    expect(await updateMealPlanPrices(input)).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(3);
    for (const plan of ["BB", "HB", "FB"] as const) {
      expect(mocks.update).toHaveBeenCalledWith({ where: { code: `MEAL-${plan}` }, data: { defaultPrice: new Prisma.Decimal(input[plan]) } });
    }
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/revenue/meal-plans");
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/fo/reservasi/new");
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/fo/reservasi/[id]", "page");
  });
  it.each(["ACC", "FO", "HK", "FB", null])("denies %s before database access", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    expect(await updateMealPlanPrices(input)).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects invalid prices before database access", async () => {
    expect(await updateMealPlanPrices({ ...input, BB: -1 })).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("propagates a missing article through the transaction boundary without revalidation", async () => {
    mocks.update.mockResolvedValueOnce({}).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "6" }),
    );
    expect(await updateMealPlanPrices(input)).toEqual({ ok: false, error: "Artikel paket makan belum lengkap. Tidak ada harga yang disimpan." });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not expose database errors", async () => {
    mocks.transaction.mockRejectedValue(new Error("private connection detail"));
    const result = await updateMealPlanPrices(input);
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
