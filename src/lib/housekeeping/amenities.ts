import { z } from "zod";

export const AMENITIES_ITEMS = [
  { key: "towels", label: "Bath Towel" },
  { key: "shampoo", label: "Shampoo" },
  { key: "soap", label: "Soap" },
  { key: "dentalKit", label: "Toothbrush / Dental Kit" },
  { key: "bottledWater", label: "Bottled Water" },
] as const;

export type AmenityKey = (typeof AMENITIES_ITEMS)[number]["key"];
export const AMENITY_INGREDIENT_MAP: Record<AmenityKey, { name: string; unit: string; parLevel: number }> = {
  towels: { name: "Bath Towel", unit: "pcs", parLevel: 50 },
  shampoo: { name: "Shampoo", unit: "bottles", parLevel: 100 },
  soap: { name: "Soap", unit: "bars", parLevel: 100 },
  dentalKit: { name: "Toothbrush / Dental Kit", unit: "kits", parLevel: 100 },
  bottledWater: { name: "Bottled Water", unit: "bottles", parLevel: 120 },
};

export type AmenitiesCounts = Record<AmenityKey, number | null>;
export const EMPTY_AMENITIES: AmenitiesCounts = {
  towels: null,
  shampoo: null,
  soap: null,
  dentalKit: null,
  bottledWater: null,
};

// Blank form values mean untouched, not a recorded quantity of zero.
export const AmenitiesCountSchema = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? null : value,
  z.coerce.number({ error: "Invalid amenity quantity" })
    .int("Amenity quantity must be a whole number")
    .min(0, "Amenity quantity must be at least 0")
    .max(99, "Amenity quantity must be at most 99")
    .nullable().optional(),
);

export function formatAmenitiesNote(counts: Record<string, number | null | undefined>): string {
  const entries = AMENITIES_ITEMS.flatMap(({ key, label }) => {
    const count = counts[key];
    return count == null ? [] : [`${count} ${label}`];
  });
  return entries.length ? `[Amenities: ${entries.join(", ")}]` : "";
}
