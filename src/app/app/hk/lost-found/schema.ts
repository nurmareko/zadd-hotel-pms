import type { LostFoundStatus } from "@prisma/client";
import { z } from "zod";

export const LOST_FOUND_STATUS_VALUES = ["UNCLAIMED", "RETURNED"] as const;

const optionalRoomId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().int().positive("Kamar tidak valid").nullable(),
);

export const CreateLostFoundItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(500, "Deskripsi maksimal 500 karakter"),
  roomId: optionalRoomId,
});

export const ReturnLostFoundItemSchema = z.object({
  itemId: z.coerce.number().int().positive("Item tidak valid"),
  resolution: z
    .string()
    .trim()
    .max(500, "Resolusi maksimal 500 karakter")
    .optional()
    .transform((value) => (value ? value : null)),
});

export function parseLostFoundStatus(value: string | undefined) {
  return LOST_FOUND_STATUS_VALUES.some((status) => status === value)
    ? (value as LostFoundStatus)
    : undefined;
}
