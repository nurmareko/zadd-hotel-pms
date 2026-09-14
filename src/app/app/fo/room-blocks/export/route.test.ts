import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findRoomBlocks } = vi.hoisted(() => ({ auth: vi.fn(), findRoomBlocks: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("../queries", () => ({ findRoomBlocks }));
vi.mock("@/lib/date-only", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/date-only")>(),
  hotelTodayISO: () => "2026-09-14",
}));
import { GET } from "./route";

beforeEach(() => vi.resetAllMocks());

describe("room block CSV", () => {
  it.each([[null, 401], ["HK", 403], ["FB", 403], ["ACC", 403]])("denies %s before querying", async (role, status) => {
    auth.mockResolvedValue(role ? { user: { role } } : null);
    const response = await GET(new Request("http://localhost/app/fo/room-blocks/export"));
    expect(response.status).toBe(status);
    expect(findRoomBlocks).not.toHaveBeenCalled();
  });
  it.each(["startDate=2026-02-30", "startDate=2026-06-03&endDate=2026-06-01", "status=INVALID", "reason=constructor", "status=ACTIVE&status=RELEASED"])("rejects invalid filter %s", async (query) => {
    auth.mockResolvedValue({ user: { role: "FO" } });
    const response = await GET(new Request(`http://localhost/app/fo/room-blocks/export?${query}`));
    expect(response.status).toBe(400);
    expect(findRoomBlocks).not.toHaveBeenCalled();
  });
  it.each(["FO", "ADMIN"])("exports the same filters and safe Indonesian CSV for %s", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    findRoomBlocks.mockResolvedValue([{
      id: 1, roomId: 1, room: { number: "101", roomType: { name: "Deluxe" } },
      reason: "MAINTENANCE", status: "RELEASED", startDate: "2026-10-01", endDate: "2026-10-03", nights: 2,
      note: '=HYPERLINK("contoh")\nCatatan, uji', createdBy: { fullName: "@Petugas" },
    }]);
    const response = await GET(new Request("http://localhost/app/fo/room-blocks/export?q=%20101%20&startDate=2026-10-01&endDate=2026-10-03&reason=MAINTENANCE&status=RELEASED"));
    expect(findRoomBlocks).toHaveBeenCalledWith({ q: "101", startDate: "2026-10-01", endDate: "2026-10-03", reason: "MAINTENANCE", status: "RELEASED" });
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="daftar-blokir-kamar-2026-09-14.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    const csv = await response.text();
    expect(csv).toContain("Kamar,Tipe Kamar,Alasan,Tanggal Mulai,Tanggal Selesai (Eksklusif),Jumlah Malam,Status,Catatan,Dibuat Oleh");
    expect(csv).toContain('101,Deluxe,Pemeliharaan,2026-10-01,2026-10-03,2,Dilepas,"\'=HYPERLINK(""contoh"")\nCatatan, uji",\'@Petugas');
  });
});
