import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findMany, findSettings, nightlyGroupBy, reservationGroupBy } = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  findSettings: vi.fn(),
  nightlyGroupBy: vi.fn(),
  reservationGroupBy: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findMany, groupBy: reservationGroupBy },
    reservationNight: { groupBy: nightlyGroupBy },
    hotelSettings: { findUniqueOrThrow: findSettings },
  },
}));

import { generateCsv } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";

import { GET } from "./route";

const URL_BASE = "http://localhost/app/fo/reservasi/export";
const HEADERS = [
  "Nomor Reservasi", "Nama Tamu", "Nomor Telepon", "Email", "Status", "Kamar",
  "Tipe Kamar", "Tamu", "Check-in", "Check-out", "Dibuat", "Total (Rp)", "Saldo (Rp)", "Grup",
];
type CsvRow = (string | number | null)[];
const columns = HEADERS.map((header, index) => ({
  header,
  accessor: (row: CsvRow) => row[index],
}));
const decimal = (value: number | string) => new Prisma.Decimal(value);

function folio(payment: number) {
  return {
    lineItems: [
      { amount: decimal("100000.4"), article: { type: "ROOM" }, fbOrderId: null },
      { amount: decimal("250.6"), article: { type: "SERVICE" }, fbOrderId: null },
      { amount: decimal("5000.4"), article: { type: "FOOD" }, fbOrderId: 7 },
    ],
    payments: [{ amount: decimal(payment) }],
  };
}

function reservation(id: number, groupBookingId: string | null = null, payment?: number) {
  return {
    id,
    reservationNo: `RES-${id}`,
    guest: { fullName: `Tamu ${id}`, phone: null, email: null },
    status: "CONFIRMED",
    room: null,
    roomType: { name: "Deluxe" },
    adults: 2,
    children: 0,
    arrivalDate: new Date("2026-06-01T00:00:00.000Z"),
    departureDate: new Date("2026-06-03T00:00:00.000Z"),
    createdAt: new Date("2026-05-20T08:00:00.000Z"),
    rateAmount: decimal(100000),
    groupBookingId,
    folio: payment === undefined ? null : folio(payment),
  };
}

function expectedRow(id: number): CsvRow {
  return [
    `RES-${id}`, `Tamu ${id}`, null, null, "Terkonfirmasi", null, "Deluxe", "2 dewasa",
    "2026-06-01", "2026-06-03", "2026-05-20T08:00:00.000Z", 200000, null, null,
  ];
}

async function readCsv(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  // Response.text() strips the BOM; preserve it to compare the actual CSV wire format.
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { role: "FO" } });
  findMany.mockResolvedValue([]);
  findSettings.mockResolvedValue({ serviceChargePercent: decimal(10), taxPercent: decimal(11) });
  nightlyGroupBy.mockResolvedValue([]);
  reservationGroupBy.mockResolvedValue([]);
});

describe("reservation CSV export", () => {
  it.each([
    [null, 401], ["HK", 403], ["FB", 403], ["ACC", 403],
  ])("rejects %s before any database reads", async (role, status) => {
    auth.mockResolvedValue(role ? { user: { role } } : null);
    const response = await GET(new Request(URL_BASE));
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(status === 401 ? "Unauthorized" : "Forbidden");
    for (const query of [findMany, findSettings, nightlyGroupBy, reservationGroupBy]) {
      expect(query).not.toHaveBeenCalled();
    }
  });

  it.each(["FO", "ADMIN", "GM"])("allows %s and returns a BOM-prefixed header-only CSV for no matches", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    const today = hotelTodayISO();
    const response = await GET(new Request(URL_BASE));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="reservasi-${today}.csv"`);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await readCsv(response)).toBe(`\uFEFF${HEADERS.join(",")}`);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      orderBy: [{ arrivalDate: "asc" }, { id: "asc" }],
    }));
    expect(nightlyGroupBy).not.toHaveBeenCalled();
    expect(reservationGroupBy).not.toHaveBeenCalled();
  });

  it("streams real CSV with canonical nightly totals, rounded balances, escaping and no trailing newline", async () => {
    findMany.mockResolvedValueOnce([
      {
        ...reservation(1, "GRP-A", 20000.4),
        guest: { fullName: '=Siti, "A"', phone: "+628123", email: "siti@example.test" },
        room: { number: "101" },
        children: 1,
      },
      reservation(2, null, 200000),
      reservation(3, null, 127351),
      reservation(4),
    ]);
    nightlyGroupBy.mockResolvedValueOnce([
      {
        reservationId: 1, _count: { _all: 2 }, _sum: { rateAmount: decimal(350000) },
        _min: { date: new Date("2026-06-01T00:00:00.000Z") },
        _max: { date: new Date("2026-06-02T00:00:00.000Z") },
      },
      {
        reservationId: 2, _count: { _all: 1 }, _sum: { rateAmount: decimal(900000) },
        _min: { date: new Date("2026-06-01T00:00:00.000Z") },
        _max: { date: new Date("2026-06-01T00:00:00.000Z") },
      },
    ]);
    reservationGroupBy.mockResolvedValueOnce([{ groupBookingId: "GRP-A", _count: { _all: 8 } }]);
    const response = await GET(new Request(URL_BASE));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(Array.from(first.value!.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const chunks = [decoder.decode(first.value)];
    expect(chunks[0]).toBe(`\uFEFF${HEADERS.join(",")}`);
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const text = decoder.decode(chunk.value);
      expect(text.startsWith("\r\n")).toBe(true);
      expect(text).not.toContain("\uFEFF");
      chunks.push(text);
    }
    // 100000 + 10000 service + 12100 tax + 251 extra + 5000 inclusive = 127351.
    const due = expectedRow(1);
    due.splice(1, 7, '=Siti, "A"', "+628123", "siti@example.test", "Terkonfirmasi", "101", "Deluxe", "2 dewasa, 1 anak");
    due[11] = 350000;
    due[12] = 107351;
    due[13] = "GRP-A (8 kamar)";
    const credit = expectedRow(2);
    credit[12] = -72649;
    const settled = expectedRow(3);
    settled[12] = 0;
    const csv = chunks.join("");
    expect(csv).toBe(generateCsv(columns, [due, credit, settled, expectedRow(4)]));
    expect(csv).toContain('"\'=Siti, ""A""",+628123');
    expect(csv.endsWith("\r\n")).toBe(false);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("exports 101 rows once each using bounded cursor batches and batch-local aggregation scopes", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => reservation(index + 1, "GRP-A"));
    findMany.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([reservation(101, "GRP-B")]);
    reservationGroupBy
      .mockResolvedValueOnce([{ groupBookingId: "GRP-A", _count: { _all: 120 } }])
      .mockResolvedValueOnce([{ groupBookingId: "GRP-B", _count: { _all: 3 } }]);
    const response = await GET(new Request(URL_BASE));
    const csv = await readCsv(response);
    const rows = Array.from({ length: 101 }, (_, index) => {
      const row = expectedRow(index + 1);
      row[13] = index < 100 ? "GRP-A (120 kamar)" : "GRP-B (3 kamar)";
      return row;
    });
    expect(csv).toBe(generateCsv(columns, rows));
    expect(csv.split("\r\n")).toHaveLength(102);
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [query] of findMany.mock.calls) {
      expect(query).toMatchObject({ take: 100, orderBy: [{ arrivalDate: "asc" }, { id: "asc" }] });
    }
    expect(findMany.mock.calls[0][0].cursor).toBeUndefined();
    expect(findMany.mock.calls[0][0].skip ?? 0).toBe(0);
    expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 100 }, skip: 1 });
    expect(findSettings).toHaveBeenCalledTimes(1);
    expect(nightlyGroupBy).toHaveBeenCalledTimes(2);
    for (const [index, ids] of [firstBatch.map((row) => row.id), [101]].entries()) {
      expect(nightlyGroupBy).toHaveBeenNthCalledWith(index + 1, {
        by: ["reservationId"], where: { reservationId: { in: ids } },
        _count: { _all: true }, _sum: { rateAmount: true }, _min: { date: true }, _max: { date: true },
      });
    }
    expect(reservationGroupBy).toHaveBeenCalledTimes(2);
    for (const [index, groupId] of ["GRP-A", "GRP-B"].entries()) {
      expect(reservationGroupBy).toHaveBeenNthCalledWith(index + 1, {
        by: ["groupBookingId"], where: { groupBookingId: { in: [groupId] } }, _count: { _all: true },
      });
    }
  });

  it("terminates after an empty follow-up to exactly 100 rows without aggregating the empty batch", async () => {
    findMany.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => reservation(index + 1)));
    const csv = await readCsv(await GET(new Request(URL_BASE)));
    expect(csv).toBe(generateCsv(columns, Array.from({ length: 100 }, (_, index) => expectedRow(index + 1))));
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toMatchObject({ take: 100, cursor: { id: 100 }, skip: 1 });
    expect(nightlyGroupBy).toHaveBeenCalledTimes(1);
    expect(reservationGroupBy).not.toHaveBeenCalled();
  });

  it("preserves search, status and date filters in every batch while ignoring list pagination", async () => {
    findMany.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => reservation(index + 1)));
    await readCsv(await GET(new Request(`${URL_BASE}?q=%20Siti%20&q=ignored&status=checked_in&checkIn=2026-06-01&checkOut=2026-06-03&page=9`)));
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [query] of findMany.mock.calls) {
      expect(query.where).toEqual({
        OR: [
          { reservationNo: { contains: "Siti", mode: "insensitive" } },
          { guest: { fullName: { contains: "Siti", mode: "insensitive" } } },
          { room: { number: { contains: "Siti", mode: "insensitive" } } },
        ],
        status: "CHECKED_IN",
        arrivalDate: { gte: new Date("2026-06-01T00:00:00.000Z") },
        departureDate: { lte: new Date("2026-06-03T00:00:00.000Z") },
      });
    }
    expect(findMany.mock.calls[0][0].skip ?? 0).toBe(0);
    expect(findMany.mock.calls[1][0].skip).toBe(1);
  });
});
