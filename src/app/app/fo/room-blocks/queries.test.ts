import { beforeEach, describe, expect, it, vi } from "vitest";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { roomBlock: { findMany } } }));
import { findRoomBlocks } from "./queries";
import { blockFilterWhere, parseBlockFilters } from "./filters";

beforeEach(() => vi.resetAllMocks());

describe("room block management query", () => {
  it("uses the shared filters and maps date-only values and full block night counts", async () => {
    findMany.mockResolvedValue([{
      id: 4, roomId: 7, reason: "INSPECTION", status: "RELEASED", note: null,
      startDate: new Date("2028-02-28T00:00:00Z"), endDate: new Date("2028-03-01T00:00:00Z"),
      room: { number: "107", roomType: { name: "Deluxe" } }, createdBy: { fullName: "Petugas" },
    }]);
    const parsed = parseBlockFilters({ q: "107", startDate: "2028-02-29", endDate: "2028-03-01", reason: "INSPECTION", status: "RELEASED" });
    if (!parsed.ok) throw new Error("Expected valid filters");
    const rows = await findRoomBlocks(parsed.filters);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: blockFilterWhere(parsed.filters), orderBy: [{ startDate: "desc" }, { id: "desc" }],
    }));
    expect(rows[0]).toMatchObject({ startDate: "2028-02-28", endDate: "2028-03-01", nights: 2, status: "RELEASED", note: null });
  });
});
