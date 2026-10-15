import { z } from "zod";

export const LOST_FOUND_CATEGORY_VALUES = ["ELECTRONICS", "CLOTHING", "DOCUMENTS", "VALUABLES", "ACCESSORIES", "OTHER"] as const;
export const LOST_FOUND_STATUS_VALUES = ["UNCLAIMED", "RETURNED", "DISPOSED"] as const;
export const lostFoundCategorySchema = z.enum(LOST_FOUND_CATEGORY_VALUES, { error: "Invalid item category." });
export const lostFoundStatusSchema = z.enum(LOST_FOUND_STATUS_VALUES, { error: "Invalid item status." });

export function lostFoundIdSchema(message: string) {
  return z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number({ error: message }).int({ error: message }).positive({ error: message }).max(2147483647, { error: message }),
  );
}

const optionalText = (label: string, max: number) => z.string({ error: `Invalid ${label}.` }).trim()
  .max(max, `${label} must be at most ${max} characters.`).nullish().transform((value) => value || null);
const requiredText = (label: string, min: number, max: number) => z.string({ error: `${label} is required.` }).trim()
  .min(min, `${label} must be at least ${min} characters.`).max(max, `${label} must be at most ${max} characters.`);

export const CreateLostFoundItemSchema = z.object({
  description: requiredText("Description", 3, 500),
  roomId: z.preprocess((value) => value === "" || value == null ? null : value, lostFoundIdSchema("Invalid room.").nullable()),
  category: lostFoundCategorySchema.default("OTHER"),
  locationDetails: optionalText("Location details", 500),
});

// Legacy forms contain only itemId and resolution; new claim forms require a name.
export const ReturnLostFoundItemSchema = z.object({
  itemId: lostFoundIdSchema("Invalid item."),
  claimantName: optionalText("Claimant name", 200),
  claimantPhone: optionalText("Claimant phone number", 50),
  claimantIdNumber: optionalText("Claimant ID number", 100),
  resolution: optionalText("Return notes", 500),
});
export const ClaimLostFoundItemSchema = ReturnLostFoundItemSchema.extend({ claimantName: requiredText("Claimant name", 1, 200) });
export const DisposeLostFoundItemSchema = z.object({
  itemId: lostFoundIdSchema("Invalid item."),
  disposalReason: requiredText("Disposal/donation reason", 1, 500),
  notes: optionalText("Disposal/donation notes", 500),
});

export function parseLostFoundStatus(value: string | undefined) {
  const parsed = lostFoundStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export type LostFoundActionResult =
  | { ok: true; itemId: number; referenceCode: string }
  | { ok: false; error: string };
