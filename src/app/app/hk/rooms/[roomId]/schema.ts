import { z } from "zod";
import { AmenitiesCountSchema } from "@/lib/housekeeping/amenities";

const OptionalNotesSchema = z
  .string()
  .trim()
  .max(500, "Notes must not exceed 500 characters")
  .optional()
  .transform((value) => (value ? value : null));

const FormBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "on", "yes"].includes(value.toLowerCase());
  }

  return false;
}, z.boolean());

export const RoomActionSchema = z.object({
  roomId: z.coerce.number().int().positive("Invalid room"),
});

export const FinishCleaningSchema = RoomActionSchema.extend({
  linenChanged: FormBooleanSchema,
  towelChanged: FormBooleanSchema,
  note: OptionalNotesSchema,
  towels: AmenitiesCountSchema,
  shampoo: AmenitiesCountSchema,
  soap: AmenitiesCountSchema,
  dentalKit: AmenitiesCountSchema,
  bottledWater: AmenitiesCountSchema,
});

export const LogFoundItemSchema = RoomActionSchema.extend({
  description: z
    .string()
    .trim()
    .min(3, "The description must be at least 3 characters")
    .max(500, "The description must not exceed 500 characters"),
});

export const InspectRoomSchema = RoomActionSchema.extend({
  passed: FormBooleanSchema,
  notes: OptionalNotesSchema,
}).refine((data) => data.passed || Boolean(data.notes?.trim()), {
  message: "A reason is required for a failed inspection",
  path: ["notes"],
});

export type ActionResult = { ok: true } | { ok: false; error: string };
