import { z } from "zod";

const OptionalAddressSchema = z
  .string()
  .trim()
  .max(1000, "Address must not exceed 1,000 characters")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const PercentSchema = z.coerce
  .number("Percentage is required")
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage must not exceed 100");

export const HotelSettingsUpdateSchema = z.object({
  hotelName: z
    .string()
    .trim()
    .min(1, "Hotel name is required")
    .max(100, "Hotel name must not exceed 100 characters"),
  address: OptionalAddressSchema,
  taxPercent: PercentSchema,
  serviceChargePercent: PercentSchema,
  nightAuditTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Night Audit time must use HH:MM format"),
  currency: z
    .string()
    .trim()
    .min(1, "Currency is required")
    .max(5, "Currency must not exceed 5 characters")
    .transform((value) => value.toUpperCase()),
});
