import { z } from "zod";

const OptionalAddressSchema = z
  .string()
  .trim()
  .max(1000, "Address must be 1000 characters or fewer")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const PercentSchema = z.coerce
  .number("Percent is required")
  .min(0, "Percent must be at least 0")
  .max(100, "Percent must be 100 or less");

export const HotelSettingsUpdateSchema = z.object({
  hotelName: z
    .string()
    .trim()
    .min(1, "Hotel name is required")
    .max(100, "Hotel name must be 100 characters or fewer"),
  address: OptionalAddressSchema,
  taxPercent: PercentSchema,
  serviceChargePercent: PercentSchema,
  nightAuditTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Night audit time must use HH:MM"),
  currency: z
    .string()
    .trim()
    .min(1, "Currency is required")
    .max(5, "Currency must be 5 characters or fewer")
    .transform((value) => value.toUpperCase()),
});

export type HotelSettingsFormInput = z.input<
  typeof HotelSettingsUpdateSchema
>;
export type HotelSettingsFormValues = z.output<
  typeof HotelSettingsUpdateSchema
>;
