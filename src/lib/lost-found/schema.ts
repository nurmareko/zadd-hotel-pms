import { z } from "zod";

export const LOST_FOUND_CATEGORY_VALUES = ["ELECTRONICS", "CLOTHING", "DOCUMENTS", "VALUABLES", "ACCESSORIES", "OTHER"] as const;
export const LOST_FOUND_STATUS_VALUES = ["UNCLAIMED", "RETURNED", "DISPOSED"] as const;
export const lostFoundCategorySchema = z.enum(LOST_FOUND_CATEGORY_VALUES, { error: "Kategori barang tidak valid." });
export const lostFoundStatusSchema = z.enum(LOST_FOUND_STATUS_VALUES, { error: "Status barang tidak valid." });

export function lostFoundIdSchema(message: string) {
  return z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number({ error: message }).int({ error: message }).positive({ error: message }).max(2147483647, { error: message }),
  );
}

const optionalText = (label: string, max: number) => z.string({ error: `${label} tidak valid.` }).trim()
  .max(max, `${label} maksimal ${max} karakter.`).nullish().transform((value) => value || null);
const requiredText = (label: string, min: number, max: number) => z.string({ error: `${label} wajib diisi.` }).trim()
  .min(min, `${label} minimal ${min} karakter.`).max(max, `${label} maksimal ${max} karakter.`);

export const CreateLostFoundItemSchema = z.object({
  description: requiredText("Deskripsi", 3, 500),
  roomId: z.preprocess((value) => value === "" || value == null ? null : value, lostFoundIdSchema("Kamar tidak valid.").nullable()),
  category: lostFoundCategorySchema.default("OTHER"),
  locationDetails: optionalText("Detail lokasi", 500),
});

// Legacy forms contain only itemId and resolution; new claim forms require a name.
export const ReturnLostFoundItemSchema = z.object({
  itemId: lostFoundIdSchema("Barang tidak valid."),
  claimantName: optionalText("Nama pengambil", 200),
  claimantPhone: optionalText("Nomor telepon pengambil", 50),
  claimantIdNumber: optionalText("Nomor identitas pengambil", 100),
  resolution: optionalText("Catatan pengembalian", 500),
});
export const ClaimLostFoundItemSchema = ReturnLostFoundItemSchema.extend({ claimantName: requiredText("Nama pengambil", 1, 200) });
export const DisposeLostFoundItemSchema = z.object({
  itemId: lostFoundIdSchema("Barang tidak valid."),
  disposalReason: requiredText("Alasan pemusnahan/hibah", 1, 500),
  notes: optionalText("Catatan pemusnahan/hibah", 500),
});

export function parseLostFoundStatus(value: string | undefined) {
  const parsed = lostFoundStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export type LostFoundActionResult =
  | { ok: true; itemId: number; referenceCode: string }
  | { ok: false; error: string };
