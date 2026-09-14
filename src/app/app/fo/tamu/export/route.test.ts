import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findGuests } = vi.hoisted(() => ({ auth: vi.fn(), findGuests: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/guests/queries", () => ({ findGuests }));
vi.mock("@/lib/date-only", () => ({ hotelTodayISO: () => "2026-06-01" }));

import { GET } from "./route";

beforeEach(() => vi.resetAllMocks());

describe("guest CSV export", () => {
  it.each([
    [null, 401], ["HK", 403], ["FB", 403], ["ACC", 403],
  ])("rejects %s before reading guest data", async (role, status) => {
    auth.mockResolvedValue(role ? { user: { role } } : null);
    const response = await GET(new Request("http://localhost/app/fo/tamu/export"));
    expect(response.status).toBe(status);
    expect(findGuests).not.toHaveBeenCalled();
  });

  it.each(["FO", "ADMIN"])("exports filtered nine-column CSV for %s", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    findGuests.mockResolvedValue([{
      id: 1, fullName: "=Siti", idType: "KTP", idNumber: "123",
      phone: null, email: "siti@example.test", address: "Bandung, Jawa Barat",
      nationality: "Indonesia", totalStays: 2, lastStayDate: "2026-05-20",
      lastRoomNumber: "101",
    }]);
    const response = await GET(new Request("http://localhost/app/fo/tamu/export?q=%20Siti%20"));
    expect(findGuests).toHaveBeenCalledWith("Siti");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="daftar-tamu-2026-06-01.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    const csv = await response.text();
    expect(csv.split("\r\n")).toEqual([
      "Nama Tamu,Jenis Identitas,Nomor Identitas,Nomor Telepon,Email,Alamat,Kewarganegaraan,Total Kunjungan,Kunjungan Terakhir",
      '\'=Siti,KTP,123,,siti@example.test,"Bandung, Jawa Barat",Indonesia,2,2026-05-20',
    ]);
  });
});
