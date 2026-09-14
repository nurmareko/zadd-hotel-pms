import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findGuests } = vi.hoisted(() => ({ auth: vi.fn(), findGuests: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./queries", () => ({ findGuests }));

import { searchGuestsAction } from "./actions";

beforeEach(() => vi.resetAllMocks());

describe("searchGuestsAction", () => {
  it.each([null, "HK", "FB", "ACC"])("rejects unauthorized role %s before querying", async (role) => {
    auth.mockResolvedValue(role ? { user: { role } } : null);
    await expect(searchGuestsAction("Siti")).rejects.toThrow("tidak memiliki akses");
    expect(findGuests).not.toHaveBeenCalled();
  });

  it.each(["FO", "ADMIN"])("allows %s and returns only the agreed lookup fields", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const guest = {
      id: 1, fullName: "Siti", idType: null, idNumber: null,
      phone: null, email: null, address: null, nationality: null,
      totalStays: 2, lastStayDate: "2026-06-01",
    };
    findGuests.mockResolvedValue([{ ...guest, lastRoomNumber: "101" }]);
    await expect(searchGuestsAction("  Siti  ")).resolves.toEqual([guest]);
    expect(findGuests).toHaveBeenCalledWith("Siti", 10);
  });

  it("does not query for a blank search", async () => {
    auth.mockResolvedValue({ user: { role: "FO" } });
    await expect(searchGuestsAction(" \t ")).resolves.toEqual([]);
    expect(findGuests).not.toHaveBeenCalled();
  });

  it("rejects invalid transport input", async () => {
    auth.mockResolvedValue({ user: { role: "FO" } });
    await expect(searchGuestsAction(null as unknown as string)).rejects.toThrow("tidak valid");
    expect(findGuests).not.toHaveBeenCalled();
  });
});
