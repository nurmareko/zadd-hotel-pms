import { z } from "zod";

const OptionalNotesSchema = z
  .string()
  .trim()
  .max(500, "Catatan maksimal 500 karakter")
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
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
});

export const LogFoundItemSchema = RoomActionSchema.extend({
  description: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(500, "Deskripsi maksimal 500 karakter"),
});

export const InspectRoomSchema = RoomActionSchema.extend({
  passed: FormBooleanSchema,
  notes: OptionalNotesSchema,
}).refine((data) => data.passed || Boolean(data.notes?.trim()), {
  message: "Alasan kegagalan inspeksi wajib diisi",
  path: ["notes"],
});

export type ActionResult = { ok: true } | { ok: false; error: string };
