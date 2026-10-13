import { describe, expect, it } from "vitest";
import { FinishCleaningSchema } from "@/app/app/hk/rooms/[roomId]/schema";
import { MobileFinishSchema } from "@/app/app/hk/mobile/schema";
import { AMENITIES_ITEMS, EMPTY_AMENITIES, formatAmenitiesNote } from "../amenities";

describe("formatAmenitiesNote", () => {
  it("omits untouched counts", () => {
    expect(formatAmenitiesNote(EMPTY_AMENITIES)).toBe("");
    expect(formatAmenitiesNote({})).toBe("");
  });
  it("formats partial counts in canonical order", () => {
    expect(formatAmenitiesNote({ bottledWater: 2, soap: 2, towels: 2, shampoo: null }))
      .toBe("[Amenities: 2 Handuk Mandi, 2 Sabun, 2 Air Mineral]");
  });
  it("formats every item and preserves an explicit zero", () => {
    expect(formatAmenitiesNote({ towels: 2, shampoo: 1, soap: 0, dentalKit: 2, bottledWater: 2 }))
      .toBe("[Amenities: 2 Handuk Mandi, 1 Sampo, 0 Sabun, 2 Sikat Gigi / Dental Kit, 2 Air Mineral]");
  });
  it("ignores unknown keys", () => {
    expect(formatAmenitiesNote({ arbitrary: 5, towels: undefined })).toBe("");
  });
});

for (const [name, schema] of [["desktop", FinishCleaningSchema], ["mobile", MobileFinishSchema]] as const) {
  describe(`${name} amenities validation`, () => {
    for (const { key } of AMENITIES_ITEMS) {
      it.each([null, undefined, "", "  ", 0, 1, 99, "2"])(`accepts ${key}=%s without requiring other amenities`, (value) => {
        const parsed = schema.parse({ roomId: "10", linenChanged: "on", towelChanged: "on", [key]: value });
        expect(parsed[key]).toBe(typeof value === "string" ? (value.trim() ? Number(value) : null) : value);
        expect(parsed.linenChanged).toBe(true);
        expect(parsed.towelChanged).toBe(true);
      });
      it.each([-1, 100, 1.5, "invalid", Infinity, NaN])(`rejects invalid ${key}=%s`, (value) => {
        expect(schema.safeParse({ roomId: "10", [key]: value }).success).toBe(false);
      });
    }
    it("keeps the full user note allowance with amenities", () => {
      expect(schema.safeParse({ roomId: "10", note: "x".repeat(500), towels: 99 }).success).toBe(true);
      expect(schema.safeParse({ roomId: "10", note: "x".repeat(501) }).success).toBe(false);
    });
  });
}
