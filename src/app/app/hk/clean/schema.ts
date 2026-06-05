import { z } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const RoomActionSchema = z.object({
  roomId: z.coerce.number().int().positive("Kamar tidak valid"),
});

export const ToggleAddOnSchema = z.object({
  addOnId: z.coerce.number().int().positive("Add-on tidak valid"),
  delivered: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true"),
});

export const LogFoundItemSchema = RoomActionSchema.extend({
  description: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(500, "Deskripsi maksimal 500 karakter"),
});
