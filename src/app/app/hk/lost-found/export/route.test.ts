import { LostFoundCategory, LostFoundStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findMany, findFirst } = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { lostFoundItem: { findMany }, user: { findFirst } } }));

import { GET } from "./route";

const header = "Kode Referensi,Kategori,Deskripsi,Kamar,Detail Lokasi,Ditemukan Oleh,Waktu Dicatat (UTC),Status,Nama Pengambil,Nomor Telepon Pengambil,Nomor Identitas Pengambil,Dikembalikan Oleh,Waktu Pengembalian (UTC),Catatan Penyelesaian,Dimusnahkan / Dihibahkan Oleh,Waktu Pemusnahan / Hibah (UTC),Alasan Pemusnahan / Hibah";
const request = (query = "") => new Request(`http://localhost/app/hk/lost-found/export?${query}`);
const item = () => ({
  referenceCode: "LF-2609-0001", category: "ELECTRONICS", description: "Telepon",
  room: { number: "101" }, locationDetails: "Laci", foundBy: { fullName: "Siti" },
  createdAt: new Date("2026-09-16T18:00:00Z"), status: "RETURNED",
  claimantName: "Budi", claimantPhone: "08123456789", claimantIdNumber: "ID-123",
  returnedBy: { fullName: "Ani" }, returnedAt: new Date("2026-09-17T01:00:00Z"),
  resolution: "Diambil pemilik", disposedBy: null, disposedAt: null, disposalReason: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T18:00:00Z"));
  auth.mockResolvedValue({ user: { id: "1", role: "HK" } });
  findFirst.mockResolvedValue({ id: 1 });
  findMany.mockResolvedValue([item()]);
});
afterEach(() => vi.useRealTimers());

describe("GET /app/hk/lost-found/export", () => {
  it.each([null, {}, { user: null }])("denies missing users before parsing or querying: %j", async (session) => {
    auth.mockResolvedValue(session);
    const response = await GET(request("category=invalid"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["FB", "ACC", "UNKNOWN", undefined])("denies role %s before parsing or querying", async (role) => {
    auth.mockResolvedValue({ user: { id: "1", role } });
    const response = await GET(request("category=invalid"));
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["HK", "FO", "ADMIN"])("denies revoked or inactive users before filter parsing for %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "1", role } });
    findFirst.mockResolvedValue(null);
    const response = await GET(request("category=invalid"));
    expect(response.status).toBe(403);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 1, isActive: true, roles: { some: { role: { code: role } } } },
      select: { id: true },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "abc", "1abc", "1.5", "0", "-1", "2147483648", "9007199254740992"])("denies invalid user ID %s without querying", async (id) => {
    auth.mockResolvedValue({ user: { id, role: "HK" } });
    expect((await GET(request("category=invalid"))).status).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["HK", "FO", "ADMIN"])("exports registry and claim audit with BOM and no caching for %s", async (role) => {
    auth.mockResolvedValue({ user: { id: "1", role } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 1, isActive: true, roles: { some: { role: { code: role } } } },
      select: { id: true },
    });
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="lost-found-2026-09-17.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(`${header}\r\nLF-2609-0001,Elektronik / Gadget,Telepon,101,Laci,Siti,2026-09-16T18:00:00.000Z,Dikembalikan,Budi,08123456789,ID-123,Ani,2026-09-17T01:00:00.000Z,Diambil pemilik,,,`);
  });

  it("applies all shared filters, including inclusive hotel days, without pagination", async () => {
    await GET(request("q=%20Budi%20&category=ELECTRONICS&status=RETURNED&room=%20A-012%20&from=2024-02-29&to=2024-02-29"));
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      OR: [
              ...["referenceCode", "description", "claimantName", "claimantPhone", "locationDetails"].map((field) => ({ [field]: { contains: "Budi", mode: "insensitive" } })),
              { room: { number: { contains: "Budi", mode: "insensitive" } } },
            ],
      category: "ELECTRONICS", status: "RETURNED", room: { number: { contains: "A-012", mode: "insensitive" } },
      createdAt: { gte: new Date("2024-02-28T17:00:00Z"), lt: new Date("2024-02-29T17:00:00Z") },
    });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBeUndefined();
    expect(args.skip).toBeUndefined();
    expect(args.include).toBeUndefined();
    for (const relation of ["foundBy", "returnedBy", "disposedBy"]) {
      expect(args.select[relation]).toEqual({ select: { fullName: true } });
    }
  });

  it.each([
    ["from=2026-09-17", { gte: new Date("2026-09-16T17:00:00Z") }],
    ["to=2026-09-17", { lt: new Date("2026-09-17T17:00:00Z") }],
  ])("supports open-ended dates: %s", async (query, createdAt) => {
    await GET(request(query));
    expect(findMany.mock.calls[0][0].where).toEqual({ createdAt });
  });

  it("uses first repeated values like the shared parser", async () => {
    await GET(request("status=RETURNED&status=invalid&q=Budi&q=Ani"));
    expect(findMany.mock.calls[0][0].where.status).toBe("RETURNED");
    expect(findMany.mock.calls[0][0].where.OR[0]).toEqual({ referenceCode: { contains: "Budi", mode: "insensitive" } });
  });

  it.each([
    "category=invalid", "status=invalid", `room=${"x".repeat(21)}`,
    "from=2026-02-29", "to=2026-13-01", "from=2026-09-18&to=2026-09-17",
    `q=${"x".repeat(201)}`,
  ])("returns an Indonesian validation error without querying: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await response.text()).toMatch(/tidak valid|tidak boleh|maksimal/);
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([
    ...Object.values(LostFoundCategory).map((category) => `category=${category}`),
    ...Object.values(LostFoundStatus).map((status) => `status=${status}`),
    "q=&category=&status=&room=&from=&to=",
    "room=0", "room=abc", "room=1.5", "room=001", `room=${"x".repeat(20)}`,
  ])("accepts shared filter values: %s", async (query) => {
    expect((await GET(request(query))).status).toBe(200);
  });

  it("exports only the header when no items match", async () => {
    findMany.mockResolvedValue([]);
    expect(await (await GET(request())).text()).toBe(header);
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  it("exports disposal audit and leaves missing historical claim fields empty", async () => {
    findMany.mockResolvedValue([{ ...item(), category: "OTHER", status: "DISPOSED", room: null,
      locationDetails: null, claimantName: null, claimantPhone: null, claimantIdNumber: null,
      returnedBy: null, returnedAt: null, resolution: null,
      disposedBy: { fullName: "Dewi" }, disposedAt: new Date("2026-09-18T02:00:00Z"), disposalReason: "Masa simpan habis",
    }]);
    expect(await (await GET(request())).text()).toBe(`${header}\r\nLF-2609-0001,Lainnya,Telepon,,,Siti,2026-09-16T18:00:00.000Z,Dimusnahkan / Dihibahkan,,,,,,,Dewi,2026-09-18T02:00:00.000Z,Masa simpan habis`);
  });

  it("escapes commas, quotes and newlines", async () => {
    findMany.mockResolvedValue([{ ...item(), description: 'Tas, "biru"\nKulit' }]);
    expect(await (await GET(request())).text()).toContain('"Tas, ""biru""\nKulit"');
  });

  it.each(["=SUM(1,2)", "+SUM(1,2)", "-SUM(1,2)", "@SUM(1,2)", "\tSUM(1,2)", "\rSUM(1,2)"])("protects operator and claimant text against formulas: %j", async (value) => {
    findMany.mockResolvedValue([{ ...item(), description: value, claimantName: value, resolution: value }]);
    expect((await (await GET(request())).text()).split(`"'${value}"`)).toHaveLength(4);
  });

  it("does not misreport database failures as filter errors", async () => {
    findMany.mockRejectedValue(new Error("Database unavailable"));
    await expect(GET(request())).rejects.toThrow("Database unavailable");
  });
});
