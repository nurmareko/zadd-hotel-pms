import { z } from "zod";

const OptionalNotesSchema = z
  .string()
  .trim()
  .max(500, "Catatan maksimal 500 karakter")
  .optional()
  .transform((value) => (value ? value : null));

export const RoomActionSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
});

export const StopCleaningSchema = RoomActionSchema.extend({
  notes: OptionalNotesSchema,
});

export const InspectRoomSchema = RoomActionSchema.extend({
  passed: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: OptionalNotesSchema,
});

export type ActionResult = { ok: true } | { ok: false; error: string };
