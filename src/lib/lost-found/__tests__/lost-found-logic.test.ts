import { describe, expect, it } from "vitest";

import { buildLostFoundWhere, parseLostFoundFilters } from "../filters";
import { LOST_FOUND_CATEGORY_ICONS, LOST_FOUND_CATEGORY_LABELS, LOST_FOUND_STATUS_LABELS, LOST_FOUND_STATUS_STYLES } from "../labels";
import { generateLostFoundReferenceCode, getLostFoundCodeMonth } from "../reference-code";
import { ClaimLostFoundItemSchema, CreateLostFoundItemSchema, DisposeLostFoundItemSchema, ReturnLostFoundItemSchema } from "../schema";

 describe("lost-found reference codes", () => {
  it("uses the hotel month and half-open timestamp boundaries", () => {
    const now = new Date("2026-08-31T17:00:00Z");
    expect(getLostFoundCodeMonth(now)).toEqual({ prefix: "LF-2609-", start: new Date("2026-08-31T17:00:00Z"), end: new Date("2026-09-30T17:00:00Z") });
    expect(generateLostFoundReferenceCode(now, 0)).toBe("LF-2609-0001");
    expect(generateLostFoundReferenceCode(now, 41)).toBe("LF-2609-0042");
    expect(generateLostFoundReferenceCode(now, 9999)).toBe("LF-2609-10000");
  });
  it("handles the instant before midnight, leap February, and year rollover", () => {
    expect(getLostFoundCodeMonth(new Date("2026-08-31T16:59:59.999Z")).prefix).toBe("LF-2608-");
    expect(getLostFoundCodeMonth(new Date("2028-02-15T00:00:00Z")).end).toEqual(new Date("2028-02-29T17:00:00Z"));
    expect(getLostFoundCodeMonth(new Date("2026-12-31T17:00:00Z")).prefix).toBe("LF-2701-");
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects unsafe counts %s", (count) => {
    expect(() => generateLostFoundReferenceCode(new Date(), count)).toThrow();
  });
});

describe("lost-found filters", () => {
  it("normalizes first query values and searches all supported fields", () => {
    const filters = parseLostFoundFilters({ q: ["  dompet ", "ignored"], status: "UNCLAIMED", category: "VALUABLES", room: "12", from: "2026-09-01", to: "2026-09-30" });
    const where = buildLostFoundWhere(filters);
    expect(where).toMatchObject({ status: "UNCLAIMED", category: "VALUABLES", room: { number: { contains: "12", mode: "insensitive" } }, createdAt: { gte: new Date("2026-08-31T17:00:00Z"), lt: new Date("2026-09-30T17:00:00Z") } });
    for (const field of ["referenceCode", "description", "claimantName", "claimantPhone", "locationDetails"]) {
      expect(where.OR).toContainEqual({ [field]: { contains: "dompet", mode: "insensitive" } });
    }
    expect(where.OR).toContainEqual({ room: { number: { contains: "dompet", mode: "insensitive" } } });
  });
  it("treats blank filters as absent", () => {
    expect(buildLostFoundWhere(parseLostFoundFilters({ q: " ", room: "   ", category: "", status: "", from: "", to: "" }))).toEqual({});
  });
  it.each([{ from: "2026-02-30" }, { from: "2026-09-02", to: "2026-09-01" }, { room: "x".repeat(21) }, { category: "invalid" }, { status: "invalid" }])("rejects invalid filters %j", (params) => {
    expect(() => parseLostFoundFilters(params)).toThrow();
  });
  it.each(["001", "A-12", "1.5", "x".repeat(20)])("searches room-number text without ID coercion: %s", (room) => {
    const filters = parseLostFoundFilters({ room: [`  ${room}  `, "ignored"] });
    expect(filters.room).toBe(room);
    expect(buildLostFoundWhere(filters)).toEqual({ room: { number: { contains: room, mode: "insensitive" } } });
  });
  it("supports one-sided date ranges and disposed items", () => {
    expect(buildLostFoundWhere(parseLostFoundFilters({ to: "2026-12-31", status: "DISPOSED" }))).toEqual({ status: "DISPOSED", createdAt: { lt: new Date("2026-12-31T17:00:00Z") } });
  });
});

describe("lost-found form validation", () => {
  it("keeps old description-only creates compatible and defaults category", () => {
    expect(CreateLostFoundItemSchema.parse({ description: "  Dompet hitam  " })).toEqual({ description: "Dompet hitam", roomId: null, category: "OTHER", locationDetails: null });
  });
  it.each(["", " a ", "x".repeat(501)])("rejects invalid descriptions", (description) => {
    expect(CreateLostFoundItemSchema.safeParse({ description }).success).toBe(false);
  });
  it.each([true, "1e2", "-1", "2147483648", new Blob(["12"])])("rejects malformed room IDs", (roomId) => {
    expect(CreateLostFoundItemSchema.safeParse({ description: "Dompet", roomId }).success).toBe(false);
  });
  it("requires claimant name for new claims but preserves legacy return input", () => {
    expect(ClaimLostFoundItemSchema.safeParse({ itemId: "1" }).success).toBe(false);
    expect(ReturnLostFoundItemSchema.parse({ itemId: "1", resolution: " Diambil tamu " })).toMatchObject({ itemId: 1, resolution: "Diambil tamu", claimantName: null });
    expect(ClaimLostFoundItemSchema.parse({ itemId: "1", claimantName: " Sari ", claimantPhone: " +62 812-1234 ", claimantIdNumber: " 00123 " })).toMatchObject({ claimantName: "Sari", claimantPhone: "+62 812-1234", claimantIdNumber: "00123" });
  });
  it("requires a disposal reason and accepts optional notes", () => {
    const invalid = DisposeLostFoundItemSchema.safeParse({ itemId: "1", disposalReason: " " });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0].message).toBe("Alasan pemusnahan/hibah minimal 1 karakter.");
    const invalidNotes = DisposeLostFoundItemSchema.safeParse({ itemId: "1", disposalReason: "Rusak", notes: "x".repeat(501) });
    expect(invalidNotes.success).toBe(false);
    if (!invalidNotes.success) expect(invalidNotes.error.issues[0].message).toBe("Catatan pemusnahan/hibah maksimal 500 karakter.");
    expect(DisposeLostFoundItemSchema.parse({ itemId: "1", disposalReason: " Rusak ", notes: " Disetujui petugas " })).toEqual({ itemId: 1, disposalReason: "Rusak", notes: "Disetujui petugas" });
  });
  it("has complete category and status presentation mappings", () => {
    expect(LOST_FOUND_CATEGORY_LABELS).toEqual({
      ELECTRONICS: "Elektronik / Gadget", CLOTHING: "Pakaian / Tekstil", DOCUMENTS: "Dokumen / Identitas",
      VALUABLES: "Barang Berharga", ACCESSORIES: "Aksesoris / Pribadi", OTHER: "Lainnya",
    });
    expect(Object.keys(LOST_FOUND_CATEGORY_ICONS)).toEqual(Object.keys(LOST_FOUND_CATEGORY_LABELS));
    expect(LOST_FOUND_STATUS_LABELS).toEqual({
      UNCLAIMED: "Disimpan", RETURNED: "Dikembalikan", DISPOSED: "Dimusnahkan / Dihibahkan",
    });
    for (const style of Object.values(LOST_FOUND_STATUS_STYLES)) {
      expect(style.badge).toBeTruthy();
      expect(style.pip).toBeTruthy();
    }
  });
});
