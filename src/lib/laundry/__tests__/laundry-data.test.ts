import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, groupBy, findMany } = vi.hoisted(() => ({
  auth: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { linenBatch: { groupBy, findMany } } }));

import { getLaundrySummary, getLinenBatches } from "../data";

beforeEach(() => {
  vi.resetAllMocks();
  groupBy.mockResolvedValue([]);
  findMany.mockResolvedValue([]);
});

describe("laundry data authorization", () => {
  it.each(["HK", "ADMIN", "GM"])("allows %s through the laundry capability", async (role) => {
    auth.mockResolvedValue({ user: { id: "7", role } });
    expect(await getLaundrySummary()).toEqual({ cleanCount: 0, washingCount: 0, sentCount: 0, damagedCount: 0 });
    expect(await getLinenBatches()).toEqual([]);
    expect(groupBy).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledOnce();
  });

  it.each([null, "FO", "FB", "ACC", "UNKNOWN"])("denies %s before querying laundry", async (role) => {
    auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    await expect(getLaundrySummary()).rejects.toThrow("Tidak berwenang mengakses data laundry.");
    await expect(getLinenBatches()).rejects.toThrow("Tidak berwenang mengakses data laundry.");
    expect(groupBy).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
