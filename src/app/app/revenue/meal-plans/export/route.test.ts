import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findMany } = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { article: { findMany } } }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T17:30:00Z"));
  auth.mockResolvedValue({ user: { role: "ADMIN" } });
  findMany.mockResolvedValue([
    { code: "MEAL-FB", defaultPrice: new Prisma.Decimal(310000) },
    { code: "MEAL-BB", defaultPrice: new Prisma.Decimal(65000) },
    { code: "MEAL-HB", defaultPrice: new Prisma.Decimal(175000) },
  ]);
});

afterEach(() => vi.useRealTimers());

describe("meal plan CSV export", () => {
  it.each([null, {}, { user: null }])("rejects a missing session or user (%j) before querying", async (session) => {
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

  it.each(["ADMIN", "GM"])("exports all four packages with current catalog prices for %s", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe([
      "Kode Paket,Nama Paket,Kode Artikel,Harga (Rp/Tamu/Malam),Keterangan",
      "RO,Tanpa makan,-,0,Tetap",
      "BB,Sarapan,MEAL-BB,65000,Dapat dikonfigurasi",
      "HB,Sarapan + satu kali makan utama,MEAL-HB,175000,Dapat dikonfigurasi",
      'FB,"Sarapan, makan siang, dan makan malam",MEAL-FB,310000,Dapat dikonfigurasi',
    ].join("\r\n"));
  });

  it("returns UTF-8 BOM, CSV download headers, no-store, and the hotel-local date", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="paket-makan-2026-09-29.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("preserves configured zero prices and falls back for null or missing catalog prices", async () => {
    findMany.mockResolvedValue([
      { code: "MEAL-BB", defaultPrice: new Prisma.Decimal(0) },
      { code: "MEAL-HB", defaultPrice: null },
    ]);
    const csv = await (await GET()).text();
    expect(csv).toContain("RO,Tanpa makan,-,0,Tetap");
    expect(csv).toContain("BB,Sarapan,MEAL-BB,0,Dapat dikonfigurasi");
    expect(csv).toContain("HB,Sarapan + satu kali makan utama,MEAL-HB,150000,Dapat dikonfigurasi");
    expect(csv).toContain('FB,"Sarapan, makan siang, dan makan malam",MEAL-FB,250000,Dapat dikonfigurasi');
  });

  it("exports all packages even when the catalog is empty", async () => {
    findMany.mockResolvedValue([]);
    const csv = await (await GET()).text();
    expect(csv.split("\r\n")).toHaveLength(5);
    expect(csv).toContain("RO,Tanpa makan,-,0,Tetap");
    expect(csv).toContain("BB,Sarapan,MEAL-BB,50000,Dapat dikonfigurasi");
    expect(csv).toContain("HB,Sarapan + satu kali makan utama,MEAL-HB,150000,Dapat dikonfigurasi");
    expect(csv).toContain('FB,"Sarapan, makan siang, dan makan malam",MEAL-FB,250000,Dapat dikonfigurasi');
  });

  it("does not silently export fallback prices on a database failure", async () => {
    findMany.mockRejectedValue(new Error("offline"));
    await expect(GET()).rejects.toThrow("offline");
  });
});
