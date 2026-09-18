import { describe, expect, it } from "vitest";
import {
  appendReceiptNotes, buildLaundryWhere, CreateLinenBatchSchema,
  formatLaundryDate, formatLaundryQuantity, generateLinenBatchCode,
  getLaundryCodeMonth, reconcileLinenBatch, ReceiveLinenBatchSchema,
  AdvanceLinenBatchStatusSchema, LaundryFiltersSchema,
  LINEN_ITEM_LABELS, LINEN_STATUS_LABELS,
} from "../logic";

const batchId = "cmabcdefghijklmnopqrstuvw";

describe("linen reconciliation", () => {
  it("keeps unreceived batches pending rather than reporting loss", () => {
    expect(reconcileLinenBatch(20, null, 0)).toEqual({ lostQuantity: null, isReconciled: false });
  });
  it("separates usable, damaged and lost units", () => {
    expect(reconcileLinenBatch(20, 15, 2)).toEqual({ lostQuantity: 3, isReconciled: true });
    expect(reconcileLinenBatch(20, 0, 20).lostQuantity).toBe(0);
    expect(reconcileLinenBatch(20, 0, 0).lostQuantity).toBe(20);
  });
  it.each([[0, 0, 0], [-1, 0, 0], [10, -1, 0], [10, 1.5, 0], [10, 9, 2], [10, 0, -1], [Infinity, 0, 0]])(
    "rejects invalid reconciliation %j / %j / %j", (sent, received, damaged) => {
      expect(() => reconcileLinenBatch(sent, received, damaged)).toThrow();
    },
  );
  it("appends receipt notes without overwriting dispatch notes", () => {
    expect(appendReceiptNotes("Catatan kirim", " Dua rusak ")).toBe("Catatan kirim\nCatatan penerimaan: Dua rusak");
    expect(appendReceiptNotes("Catatan kirim", " ")).toBe("Catatan kirim");
    expect(appendReceiptNotes(null, "Diterima")).toBe("Catatan penerimaan: Diterima");
  });
});

describe("monthly batch codes", () => {
  it("uses the hotel month at the UTC month boundary", () => {
    const now = new Date("2026-05-31T17:00:00.000Z");
    expect(generateLinenBatchCode(now, 0)).toBe("LND-2606-0001");
    expect(generateLinenBatchCode(now, 41)).toBe("LND-2606-0042");
    expect(getLaundryCodeMonth(now)).toEqual({
      prefix: "LND-2606-", start: new Date("2026-05-31T17:00:00Z"),
      end: new Date("2026-06-30T17:00:00Z"),
    });
    expect(getLaundryCodeMonth(new Date("2026-12-31T17:00:00Z")).prefix).toBe("LND-2701-");
  });
  it.each([-1, 0.5, NaN, 9999])("rejects invalid or exhausted monthly counts %s", (count) => {
    expect(() => generateLinenBatchCode(new Date("2026-06-01"), count)).toThrow();
  });
});

describe("laundry filters", () => {
  it("supports empty filters", () => expect(buildLaundryWhere({})).toEqual({}));
  it("combines case-insensitive search, enums and inclusive WIB dates", () => {
    expect(buildLaundryWhere({ q: " vendor ", status: "SENT", itemType: "BED_SHEET", dateFrom: "2026-06-01", dateTo: "2026-06-02" })).toEqual({
      OR: ["batchCode", "vendor", "notes"].map((key) => ({ [key]: { contains: "vendor", mode: "insensitive" } })),
      status: "SENT", itemType: "BED_SHEET",
      sentAt: { gte: new Date("2026-05-31T17:00:00Z"), lt: new Date("2026-06-02T17:00:00Z") },
    });
  });
  it("allows one-sided ranges and empty select values", () => {
    expect(buildLaundryWhere({ dateTo: "2026-06-01", status: "", itemType: "", q: " " })).toEqual({ sentAt: { lt: new Date("2026-06-01T17:00:00Z") } });
  });
  it.each([{ status: "BROKEN" }, { itemType: "INVALID" }, { dateFrom: "2026-02-30" }, { dateTo: "yesterday" }, { dateFrom: "2026-06-02", dateTo: "2026-06-01" }, { q: ["x"] }])("rejects invalid filters %j", (filters) => {
    expect(LaundryFiltersSchema.safeParse(filters).success).toBe(false);
  });
});

describe("action input validation", () => {
  it("parses integer form values and trims optional text", () => {
    expect(CreateLinenBatchSchema.parse({ itemType: "BED_SHEET", sentQuantity: "12", vendor: " A ", notes: " " })).toEqual({ itemType: "BED_SHEET", sentQuantity: 12, vendor: "A", notes: null });
    expect(ReceiveLinenBatchSchema.parse({ batchId, receivedQuantity: "0", damagedQuantity: "0" }).receivedQuantity).toBe(0);
    expect(AdvanceLinenBatchStatusSchema.safeParse({ batchId }).success).toBe(true);
  });
  it.each(["", " ", "1.5", "1e2", "0x10", "-1", "0", "2147483648", null, true, Infinity])("rejects invalid sent quantity %s", (sentQuantity) => {
    expect(CreateLinenBatchSchema.safeParse({ itemType: "OTHER", sentQuantity }).success).toBe(false);
  });
  it("rejects invalid identities, enums and missing receipt quantities", () => {
    expect(AdvanceLinenBatchStatusSchema.safeParse({ batchId: "42" }).success).toBe(false);
    expect(CreateLinenBatchSchema.safeParse({ itemType: "BAD", sentQuantity: "1" }).success).toBe(false);
    expect(ReceiveLinenBatchSchema.safeParse({ batchId, receivedQuantity: "", damagedQuantity: "0" }).success).toBe(false);
    expect(ReceiveLinenBatchSchema.safeParse({ batchId, receivedQuantity: "1", damagedQuantity: "-1" }).success).toBe(false);
  });
  it("formats copy in Indonesian with explicit hotel timezone", () => {
    expect(LINEN_ITEM_LABELS.BED_SHEET).toBe("Sprei");
    expect(LINEN_STATUS_LABELS.WASHING).toBe("Sedang Dicuci");
    expect(formatLaundryQuantity(1000)).toBe("1.000");
    expect(formatLaundryDate(null)).toBe("—");
    expect(formatLaundryDate(new Date("2026-05-31T17:00:00Z"))).toContain("1 Jun 2026");
  });
});
