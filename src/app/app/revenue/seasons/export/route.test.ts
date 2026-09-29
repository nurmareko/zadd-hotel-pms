import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { auth, findMany } = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { pricingRule: { findMany } } }));
import { GET } from "./route";

const header = "Nama Aturan,Kode Tipe Kamar,Tipe Kamar,Tarif Dasar (Rp),Jenis Periode,Hari,Tanggal Mulai,Tanggal Selesai (Eksklusif),Jenis Penyesuaian,Nilai Penyesuaian,Status";
const rule = {
  name: "Akhir pekan",
  roomType: { code: "DLX", name: "Deluxe", baseRate: new Prisma.Decimal(500000) },
  selectorKind: "DAY_OF_WEEK", dayOfWeek: "SATURDAY", startsOn: null, endsBefore: null,
  adjustmentKind: "AMOUNT_DELTA", adjustmentValue: new Prisma.Decimal(50000), isActive: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T18:00:00Z"));
  auth.mockResolvedValue({ user: { role: "ADMIN" } });
  findMany.mockResolvedValue([rule]);
});
afterEach(() => vi.useRealTimers());

describe("season CSV export", () => {
  it.each([null, {}])("rejects missing session/user %j before querying", async (session) => {
    auth.mockResolvedValue(session);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Silakan masuk terlebih dahulu.");
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["FO", "HK", "FB", "ACC"])("rejects %s before querying", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Anda tidak memiliki akses untuk mengekspor data pendapatan.");
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "GM"])("exports all rules for %s with Indonesian columns and hotel-date filename", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="musim-tarif-2026-09-29.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(findMany).toHaveBeenCalledWith({ include: { roomType: true }, orderBy: [{ roomType: { name: "asc" } }, { name: "asc" }] });
    expect(await response.text()).toBe(`${header}\r\nAkhir pekan,DLX,Deluxe,500000,Hari mingguan,Sabtu,-,-,Nominal (Rp),'+Rp 50.000,Aktif`);
  });

  it("includes the UTF-8 BOM bytes", async () => {
    const bytes = new Uint8Array(await (await GET()).arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).startsWith("\uFEFF")).toBe(true);
  });

  it("exports date ranges, exclusive end dates, percentages and inactive rules", async () => {
    findMany.mockResolvedValue([{ ...rule, selectorKind: "DATE_RANGE", dayOfWeek: null,
      startsOn: new Date("2026-10-01T00:00:00Z"), endsBefore: new Date("2026-10-05T00:00:00Z"),
      adjustmentKind: "PERCENT_DELTA", adjustmentValue: new Prisma.Decimal(15), isActive: false }]);
    expect(await (await GET()).text()).toContain("Rentang tanggal,-,2026-10-01,2026-10-05,Persentase (%),'+15%,Nonaktif");
  });

  it.each([["MONDAY", "Senin"], ["TUESDAY", "Selasa"], ["WEDNESDAY", "Rabu"], ["THURSDAY", "Kamis"], ["FRIDAY", "Jumat"], ["SUNDAY", "Minggu"]])("translates %s", async (dayOfWeek, label) => {
    findMany.mockResolvedValue([{ ...rule, dayOfWeek }]);
    expect(await (await GET()).text()).toContain(`Hari mingguan,${label},-,-`);
  });

  it.each([[0, "0%"], [-12.5, '"\'-12,5%"']])("formats %s percent without a positive sign", async (value, expected) => {
    findMany.mockResolvedValue([{ ...rule, adjustmentKind: "PERCENT_DELTA", adjustmentValue: new Prisma.Decimal(value) }]);
    expect(await (await GET()).text()).toContain(`Persentase (%),${expected},Aktif`);
  });

  it("escapes formula injection, quotes, commas and newlines in data", async () => {
    findMany.mockResolvedValue([{ ...rule, name: '=HYPERLINK("contoh")\nCatatan, uji', roomType: { ...rule.roomType, code: "@DLX" } }]);
    expect(await (await GET()).text()).toContain('"\'=HYPERLINK(""contoh"")\nCatatan, uji",\'@DLX');
  });

  it("returns a header-only CSV for an empty catalog", async () => {
    findMany.mockResolvedValue([]);
    expect(await (await GET()).text()).toBe(header);
  });

  it("does not disguise database failure as an empty successful export", async () => {
    findMany.mockRejectedValue(new Error("Database unavailable"));
    await expect(GET()).rejects.toThrow("Database unavailable");
  });
});
