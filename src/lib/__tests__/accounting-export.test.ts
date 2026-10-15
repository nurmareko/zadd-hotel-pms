import { ArticleType, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  folio: { findMany: vi.fn() },
  fBOrder: { findMany: vi.fn() },
  hotelSettings: { findUniqueOrThrow: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  createAccountingExportCsv,
  getAccountingExportRange,
  getAccountingExportRows,
  type AccountingExportRow,
} from "@/lib/accounting-export";

const decimal = (value: number) => new Prisma.Decimal(value);
const date = new Date("2026-09-01T00:00:00.000Z");
const range = getAccountingExportRange("2026-09-01", "2026-09-30");
const order = {
  id: 7,
  subtotal: decimal(200_000),
  serviceCharge: decimal(10_000),
  tax: decimal(21_000),
  total: decimal(231_000),
};

function line(id: number, type: ArticleType, amount: number, fbOrder: typeof order | null = null) {
  return {
    id,
    postedAt: date,
    amount: decimal(amount),
    article: { code: type === ArticleType.ROOM ? "ROOM-CHARGE" : `${type}-${id}`, type },
    reservationNight: type === ArticleType.ROOM ? { date } : null,
    fbOrder,
  };
}

function setFolio(lines: ReturnType<typeof line>[]) {
  db.folio.findMany.mockResolvedValue([{
    folioNo: "FOL-001",
    reservation: { guest: { fullName: "Tamu Uji" }, room: { number: "101" } },
    lineItems: lines,
  }]);
}

function expectBalanced(row: AccountingExportRow) {
  expect(row.subtotal).toBe(row.roomRevenue + row.fbRevenue + row.hkRevenue + row.otherRevenue);
  expect(row.total).toBe(row.subtotal + row.tax);
}

beforeEach(() => {
  vi.resetAllMocks();
  db.folio.findMany.mockResolvedValue([]);
  db.fBOrder.findMany.mockResolvedValue([]);
  db.hotelSettings.findUniqueOrThrow.mockResolvedValue({
    taxPercent: decimal(10),
    serviceChargePercent: decimal(5),
  });
});

describe("accounting export revenue classification", () => {
  it("counts ROOM-CHARGE mistyped as SERVICE only as room revenue, including in CSV", async () => {
    const roomLine = line(1, ArticleType.SERVICE, 100_000);
    roomLine.article.code = "ROOM-CHARGE";
    setFolio([roomLine]);
    db.hotelSettings.findUniqueOrThrow.mockResolvedValue({
      taxPercent: decimal(0),
      serviceChargePercent: decimal(0),
    });

    const rows = await getAccountingExportRows(range);
    expect(rows[0]).toMatchObject({
      roomRevenue: 100_000, fbRevenue: 0, hkRevenue: 0,
      otherRevenue: 0, subtotal: 100_000, tax: 0, total: 100_000,
    });
    expectBalanced(rows[0]);
    const csv = await createAccountingExportCsv(rows, "accounting.csv").text();
    const [headers, values] = csv.split("\r\n").map((row) => row.split(","));
    expect(values[headers.indexOf("Housekeeping Revenue (Rp)")]).toBe("0");
  });
  it("separates multiple housekeeping lines from miscellaneous revenue and calculated service fees", async () => {
    setFolio([
      line(1, ArticleType.ROOM, 1_000_000),
      line(2, ArticleType.FB, 100_000),
      line(3, ArticleType.SERVICE, 30_000),
      line(4, ArticleType.SERVICE, 20_000),
      line(5, ArticleType.MISC, 200_000),
    ]);

    const [row] = await getAccountingExportRows(range);
    expect(row).toMatchObject({
      roomRevenue: 1_000_000, fbRevenue: 100_000, hkRevenue: 50_000,
      otherRevenue: 265_000, subtotal: 1_415_000, tax: 136_500, total: 1_551_500,
    });
    expectBalanced(row);
  });

  it("counts linked F&B service fees once in Other, never in housekeeping or the canonical fee base", async () => {
    setFolio([
      line(1, ArticleType.ROOM, 1_000_000),
      line(2, ArticleType.SERVICE, 50_000),
      line(3, ArticleType.MISC, 100_000),
      line(4, ArticleType.FB, 231_000, order),
      line(5, ArticleType.SERVICE, 231_000, order),
    ]);

    const [row] = await getAccountingExportRows(range);
    expect(row).toMatchObject({
      roomRevenue: 1_000_000, fbRevenue: 200_000, hkRevenue: 50_000,
      otherRevenue: 165_000, subtotal: 1_415_000, tax: 136_500, total: 1_551_500,
    });
    expectBalanced(row);
  });

  it("keeps housekeeping-only charges out of the percentage fee base and preserves explicit tax", async () => {
    setFolio([line(1, ArticleType.SERVICE, 50_000), line(2, ArticleType.TAX, 5_000)]);
    const [row] = await getAccountingExportRows(range);
    expect(row).toMatchObject({
      roomRevenue: 0, fbRevenue: 0, hkRevenue: 50_000,
      otherRevenue: 0, subtotal: 50_000, tax: 5_000, total: 55_000,
    });
    expectBalanced(row);
  });

  it("populates zero housekeeping for folios without SERVICE lines and standalone F&B orders", async () => {
    setFolio([line(1, ArticleType.ROOM, 1_000_000)]);
    db.fBOrder.findMany.mockResolvedValue([{ ...order, orderNo: "FB-001", closedAt: date }]);
    const rows = await getAccountingExportRows(range);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.hkRevenue).toBe(0);
      expectBalanced(row);
    }
    expect(rows.find((row) => row.invoice === "FB-001")).toMatchObject({
      roomRevenue: 0, fbRevenue: 200_000, hkRevenue: 0,
      otherRevenue: 10_000, subtotal: 210_000, tax: 21_000, total: 231_000,
    });
  });
});

describe("accounting export CSV", () => {
  const header = "Invoice,Date,Guest / Party,Room,Room Revenue (Rp),F&B Revenue (Rp),Housekeeping Revenue (Rp),Other / Spa Revenue (Rp),Subtotal (Rp),Tax (Rp),Total (Rp)";

  it("exports calculated HK and Other amounts in matching columns immediately after F&B", async () => {
    setFolio([line(1, ArticleType.SERVICE, 50_000), line(2, ArticleType.MISC, 100_000)]);
    const rows = await getAccountingExportRows(range);
    const response = createAccountingExportCsv(rows, "accounting.csv");
    expect(await response.text()).toBe(`${header}\r\nFOL-001,2026-09-01,Tamu Uji,101,0,0,50000,105000,155000,10500,165500`);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("includes the new classification headers for an empty export", async () => {
    expect(await createAccountingExportCsv([], "empty.csv").text()).toBe(header);
  });
});
