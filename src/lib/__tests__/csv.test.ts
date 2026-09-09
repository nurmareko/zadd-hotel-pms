import { describe, expect, it } from "vitest";

import {
  createCsvResponse,
  escapeCsvValue,
  generateCsv,
  type CsvColumn,
} from "@/lib/csv";

describe("escapeCsvValue", () => {
  it("escapes commas, double quotes, and line breaks using RFC 4180 quoting", () => {
    expect(escapeCsvValue("Jakarta, Indonesia")).toBe(
      '"Jakarta, Indonesia"',
    );
    expect(escapeCsvValue('Kamar "Deluxe"')).toBe('"Kamar ""Deluxe"""');
    expect(escapeCsvValue("Baris satu\nBaris dua")).toBe(
      '"Baris satu\nBaris dua"',
    );
    expect(escapeCsvValue("Baris satu\r\nBaris dua")).toBe(
      '"Baris satu\r\nBaris dua"',
    );
  });

  it.each([
    ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
    ["@cmd", "'@cmd"],
    ["\tcmd", "'\tcmd"],
    ["\rcmd", '"\'\rcmd"'],
    ["+cmd", "'+cmd"],
    ["-cmd", "'-cmd"],
    ["-1+1", "'-1+1"],
  ])("defuses formula-like value %j", (value, expected) => {
    expect(escapeCsvValue(value)).toBe(expected);
  });

  it.each([
    ["-125000", "-125000"],
    ["+125000", "+125000"],
    ["-125000.50", "-125000.50"],
    ["+125000,50", '"+125000,50"'],
    ["-", "-"],
  ])("does not alter plain numeric value %j", (value, expected) => {
    expect(escapeCsvValue(value)).toBe(expected);
  });

  it("serializes nullish and Date values", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(new Date("2026-09-10T03:04:05.000Z"))).toBe(
      "2026-09-10T03:04:05.000Z",
    );
  });
});

describe("generateCsv", () => {
  it("adds a UTF-8 BOM and uses CRLF between escaped rows", () => {
    type Row = { name: string; amount: number; active: boolean };
    const columns: CsvColumn<Row>[] = [
      { header: "Nama Tamu", accessor: (row) => row.name },
      { header: "Total (Rp)", accessor: (row) => row.amount },
      { header: "Aktif", accessor: (row) => row.active },
    ];

    expect(
      generateCsv(columns, [
        { name: "Siti, Ayu", amount: -250000, active: true },
      ]),
    ).toBe(
      '\uFEFFNama Tamu,Total (Rp),Aktif\r\n"Siti, Ayu",-250000,true',
    );
  });
});

describe("createCsvResponse", () => {
  it("creates a non-cacheable CSV attachment response", async () => {
    const response = createCsvResponse("\uFEFFNama\r\nSiti", "reservasi.csv");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="reservasi.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("Nama\r\nSiti");
  });
});
