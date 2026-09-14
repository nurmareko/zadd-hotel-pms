import { RoomBlockReason } from "@prisma/client";
import { z } from "zod";
import { isValidISODateOnly } from "@/lib/date-only";

const id = z.coerce.number().int().positive();
const date = z.string().refine(isValidISODateOnly, "Tanggal harus berupa tanggal kalender yang valid (YYYY-MM-DD).");
export const CreateRoomBlockSchema = z.object({
  roomId: id,
  startDate: date,
  endDate: date,
  reason: z.nativeEnum(RoomBlockReason).default(RoomBlockReason.MAINTENANCE),
  note: z.string().trim().max(2000, "Catatan maksimal 2000 karakter.").optional(),
}).refine((value) => value.startDate < value.endDate, {
  path: ["endDate"],
  message: "Tanggal selesai harus setelah tanggal mulai.",
});
export const ReleaseRoomBlockSchema = z.object({ blockId: id });
export type CreateRoomBlockInput = {
  roomId: number | string;
  startDate: string;
  endDate: string;
  reason?: RoomBlockReason;
  note?: string;
};
export type CreateRoomBlockValues = z.output<typeof CreateRoomBlockSchema>;
export type ReleaseRoomBlockInput = { blockId: number | string };
