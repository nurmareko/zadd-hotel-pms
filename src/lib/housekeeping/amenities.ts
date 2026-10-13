import { z } from "zod";

export const AMENITIES_ITEMS = [
  { key: "towels", label: "Handuk Mandi" },
  { key: "shampoo", label: "Sampo" },
  { key: "soap", label: "Sabun" },
  { key: "dentalKit", label: "Sikat Gigi / Dental Kit" },
  { key: "bottledWater", label: "Air Mineral" },
] as const;

export type AmenityKey = (typeof AMENITIES_ITEMS)[number]["key"];
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
  z.coerce.number({ error: "Jumlah amenities tidak valid" })
    .int("Jumlah amenities harus bilangan bulat")
    .min(0, "Jumlah amenities minimal 0")
    .max(99, "Jumlah amenities maksimal 99")
    .nullable().optional(),
);

export function formatAmenitiesNote(counts: Record<string, number | null | undefined>): string {
  const entries = AMENITIES_ITEMS.flatMap(({ key, label }) => {
    const count = counts[key];
    return count == null ? [] : [`${count} ${label}`];
  });
  return entries.length ? `[Amenities: ${entries.join(", ")}]` : "";
}
