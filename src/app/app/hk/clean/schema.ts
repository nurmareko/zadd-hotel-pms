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
