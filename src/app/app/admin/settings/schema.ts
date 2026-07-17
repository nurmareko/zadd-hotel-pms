import { z } from "zod";

const OptionalAddressSchema = z
  .string()
  .trim()
  .max(1000, "Alamat maksimal 1000 karakter")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const PercentSchema = z.coerce
  .number("Persen wajib diisi")
  .min(0, "Persen minimal 0")
  .max(100, "Persen maksimal 100");

export const HotelSettingsUpdateSchema = z.object({
  hotelName: z
    .string()
    .trim()
    .min(1, "Nama hotel wajib diisi")
    .max(100, "Nama hotel maksimal 100 karakter"),
  address: OptionalAddressSchema,
  taxPercent: PercentSchema,
  serviceChargePercent: PercentSchema,
  nightAuditTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Waktu Night Audit harus format HH:MM"),
  currency: z
    .string()
    .trim()
    .min(1, "Mata uang wajib diisi")
    .max(5, "Mata uang maksimal 5 karakter")
    .transform((value) => value.toUpperCase()),
});
